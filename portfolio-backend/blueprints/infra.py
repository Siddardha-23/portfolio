"""
Infrastructure Blueprint — Real AWS data for portfolio infra features

Endpoints:
  GET  /api/infra/costs    — Real AWS billing via Cost Explorer
  GET  /api/infra/health   — Real health via CloudWatch + service pings
  POST /api/infra/match    — AI-powered JD matching via Gemini
"""
import logging
import os
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify

logger = logging.getLogger(__name__)

infra_bp = Blueprint('infra', __name__)


# ─────────────────────────── Cost Explorer ───────────────────────────
@infra_bp.route('/costs', methods=['GET'])
def get_infra_costs():
    """
    Fetch real AWS costs from Cost Explorer API.
    Returns per-service cost breakdown for the current month.
    """
    try:
        import boto3

        ce = boto3.client('ce', region_name=os.getenv('AWS_REGION_NAME', 'us-east-1'))

        # Current month date range
        today = datetime.utcnow()
        start_of_month = today.replace(day=1).strftime('%Y-%m-%d')
        end_date = today.strftime('%Y-%m-%d')

        # Also get last full month for comparison
        last_month_end = (today.replace(day=1) - timedelta(days=1))
        last_month_start = last_month_end.replace(day=1).strftime('%Y-%m-%d')
        last_month_end_str = last_month_end.strftime('%Y-%m-%d')

        # Current month costs by service
        current_response = ce.get_cost_and_usage(
            TimePeriod={'Start': start_of_month, 'End': end_date},
            Granularity='MONTHLY',
            Metrics=['UnblendedCost'],
            GroupBy=[{'Type': 'DIMENSION', 'Key': 'SERVICE'}],
        )

        # Last month costs for comparison
        try:
            last_response = ce.get_cost_and_usage(
                TimePeriod={'Start': last_month_start, 'End': last_month_end_str},
                Granularity='MONTHLY',
                Metrics=['UnblendedCost'],
                GroupBy=[{'Type': 'DIMENSION', 'Key': 'SERVICE'}],
            )
            last_month_services = {}
            for group in last_response.get('ResultsByTime', [{}])[0].get('Groups', []):
                svc = group['Keys'][0]
                cost = float(group['Metrics']['UnblendedCost']['Amount'])
                last_month_services[svc] = cost
        except Exception:
            last_month_services = {}

        # Parse current month
        services = []
        total = 0.0
        for result in current_response.get('ResultsByTime', []):
            for group in result.get('Groups', []):
                service_name = group['Keys'][0]
                cost = float(group['Metrics']['UnblendedCost']['Amount'])
                unit = group['Metrics']['UnblendedCost']['Unit']
                if cost > 0.001:  # Skip zero-cost services
                    prev_cost = last_month_services.get(service_name, 0)
                    services.append({
                        'service': service_name,
                        'cost': round(cost, 4),
                        'unit': unit,
                        'previousMonth': round(prev_cost, 4),
                    })
                    total += cost

        # Sort by cost descending
        services.sort(key=lambda x: x['cost'], reverse=True)

        last_month_total = sum(last_month_services.values())

        # Days elapsed in current month for projection
        days_elapsed = (today - today.replace(day=1)).days or 1
        days_in_month = 30  # approximate
        projected = (total / days_elapsed) * days_in_month

        return jsonify({
            'success': True,
            'data': {
                'currentMonth': {
                    'total': round(total, 4),
                    'projected': round(projected, 4),
                    'services': services,
                    'period': {
                        'start': start_of_month,
                        'end': end_date,
                        'daysElapsed': days_elapsed,
                    },
                },
                'lastMonth': {
                    'total': round(last_month_total, 4),
                },
                'source': 'AWS Cost Explorer API',
                'timestamp': datetime.utcnow().isoformat(),
            }
        })

    except ImportError:
        logger.warning("boto3 not available for Cost Explorer")
        return jsonify({
            'success': False,
            'error': 'AWS SDK not available',
            'fallback': True,
        }), 503

    except Exception as e:
        logger.error(f"Cost Explorer error: {e}")
        return jsonify({
            'success': False,
            'error': str(e),
            'fallback': True,
        }), 500


# ─────────────────────────── Health Dashboard ───────────────────────────
@infra_bp.route('/health', methods=['GET'])
def get_infra_health():
    """
    Get real infrastructure health from CloudWatch metrics.
    Returns Lambda invocations, errors, duration, and API Gateway stats.
    """
    try:
        import boto3

        cw = boto3.client('cloudwatch', region_name=os.getenv('AWS_REGION_NAME', 'us-east-1'))
        lambda_client = boto3.client('lambda', region_name=os.getenv('AWS_REGION_NAME', 'us-east-1'))

        now = datetime.utcnow()
        start_time = now - timedelta(hours=24)
        function_name = 'portfolio-backend'

        # Lambda metrics (last 24h)
        def get_metric(namespace, metric_name, dimensions, stat='Sum'):
            try:
                resp = cw.get_metric_statistics(
                    Namespace=namespace,
                    MetricName=metric_name,
                    Dimensions=dimensions,
                    StartTime=start_time,
                    EndTime=now,
                    Period=86400,  # 24h in one data point
                    Statistics=[stat],
                )
                points = resp.get('Datapoints', [])
                if points:
                    return points[0].get(stat, 0)
                return 0
            except Exception as e:
                logger.warning(f"Metric {metric_name} fetch failed: {e}")
                return None

        lambda_dims = [{'Name': 'FunctionName', 'Value': function_name}]

        invocations = get_metric('AWS/Lambda', 'Invocations', lambda_dims, 'Sum')
        errors = get_metric('AWS/Lambda', 'Errors', lambda_dims, 'Sum')
        duration_avg = get_metric('AWS/Lambda', 'Duration', lambda_dims, 'Average')
        throttles = get_metric('AWS/Lambda', 'Throttles', lambda_dims, 'Sum')
        concurrent = get_metric('AWS/Lambda', 'ConcurrentExecutions', lambda_dims, 'Maximum')

        # Lambda function config
        try:
            fn_config = lambda_client.get_function_configuration(FunctionName=function_name)
            memory = fn_config.get('MemorySize', 512)
            timeout_config = fn_config.get('Timeout', 90)
            runtime = fn_config.get('Runtime', 'python3.12')
            code_size = fn_config.get('CodeSize', 0)
            last_modified = fn_config.get('LastModified', '')
        except Exception:
            memory = 512
            timeout_config = 90
            runtime = 'python3.12'
            code_size = 0
            last_modified = ''

        # Error rate
        error_rate = 0
        if invocations and invocations > 0:
            error_rate = round((errors / invocations) * 100, 2) if errors else 0

        # Determine overall status
        status = 'healthy'
        if error_rate > 5:
            status = 'degraded'
        if error_rate > 20 or (throttles and throttles > 0):
            status = 'critical'

        return jsonify({
            'success': True,
            'data': {
                'status': status,
                'lambda': {
                    'functionName': function_name,
                    'runtime': runtime,
                    'memory': memory,
                    'timeout': timeout_config,
                    'codeSize': code_size,
                    'lastModified': last_modified,
                    'metrics24h': {
                        'invocations': invocations,
                        'errors': errors,
                        'errorRate': error_rate,
                        'avgDuration': round(duration_avg, 1) if duration_avg else None,
                        'throttles': throttles,
                        'maxConcurrency': concurrent,
                    },
                },
                'period': '24h',
                'source': 'AWS CloudWatch',
                'timestamp': datetime.utcnow().isoformat(),
            }
        })

    except ImportError:
        return jsonify({
            'success': False,
            'error': 'AWS SDK not available',
            'fallback': True,
        }), 503

    except Exception as e:
        logger.error(f"Health check error: {e}")
        return jsonify({
            'success': False,
            'error': str(e),
            'fallback': True,
        }), 500


# ─────────────────────────── AI JD Match ───────────────────────────
@infra_bp.route('/match', methods=['POST'])
def match_jd():
    """
    Use Gemini AI to semantically analyze a job description
    against the candidate's actual skills and experience.
    """
    data = request.get_json()
    if not data or 'jd' not in data:
        return jsonify({'success': False, 'error': 'Missing job description'}), 400

    jd_text = data['jd'].strip()
    if len(jd_text) < 20:
        return jsonify({'success': False, 'error': 'Job description too short'}), 400

    if len(jd_text) > 10000:
        return jsonify({'success': False, 'error': 'Job description too long (max 10K chars)'}), 400

    try:
        from services.chat_service import _get_client, PORTFOLIO_CONTEXT
        from google.genai import types

        client = _get_client()

        match_prompt = f"""You are a professional recruiter analysis engine. Analyze the following job description against the candidate's profile and return a JSON response.

CANDIDATE PROFILE:
{PORTFOLIO_CONTEXT}

JOB DESCRIPTION:
{jd_text}

Analyze the match and return ONLY valid JSON (no markdown fences, no extra text) in this exact structure:
{{
  "overallMatch": <number 0-100>,
  "matchLabel": "<Strong Match|Good Match|Partial Match|Low Match>",
  "summary": "<2-3 sentence summary of fit>",
  "categories": [
    {{
      "name": "Cloud & AWS",
      "score": <number 0-100>,
      "matched": ["<skill1>", "<skill2>"],
      "missing": ["<skill1>"],
      "note": "<brief note>"
    }},
    {{
      "name": "DevOps & IaC",
      "score": <number 0-100>,
      "matched": ["<skill>"],
      "missing": ["<skill>"],
      "note": "<note>"
    }},
    {{
      "name": "Programming",
      "score": <number 0-100>,
      "matched": ["<skill>"],
      "missing": ["<skill>"],
      "note": "<note>"
    }},
    {{
      "name": "Security & Compliance",
      "score": <number 0-100>,
      "matched": ["<skill>"],
      "missing": ["<skill>"],
      "note": "<note>"
    }},
    {{
      "name": "Soft Skills & Experience",
      "score": <number 0-100>,
      "matched": ["<skill>"],
      "missing": ["<skill>"],
      "note": "<note>"
    }},
    {{
      "name": "Education & Certs",
      "score": <number 0-100>,
      "matched": ["<item>"],
      "missing": ["<item>"],
      "note": "<note>"
    }}
  ],
  "strengths": ["<strength1>", "<strength2>", "<strength3>"],
  "gaps": ["<gap1>", "<gap2>"],
  "recommendation": "<hire recommendation sentence>"
}}

Be honest and accurate. Only mark skills as matched if the candidate truly has them based on their profile. Score each category based on how well the candidate's actual experience matches what the JD requires."""

        response = client.models.generate_content(
            model="gemini-2.5-flash-lite",
            contents=[types.Content(role="user", parts=[types.Part(text=match_prompt)])],
            config=types.GenerateContentConfig(
                temperature=0.3,
                max_output_tokens=2048,
            ),
        )

        import json
        response_text = response.text.strip()
        # Strip markdown fences if present
        if response_text.startswith('```'):
            response_text = response_text.split('\n', 1)[1]
            if response_text.endswith('```'):
                response_text = response_text[:-3]
            response_text = response_text.strip()

        result = json.loads(response_text)

        return jsonify({
            'success': True,
            'data': result,
            'source': 'Gemini AI',
            'timestamp': datetime.utcnow().isoformat(),
        })

    except ImportError as e:
        logger.error(f"Gemini import error: {e}")
        return jsonify({
            'success': False,
            'error': 'AI service not available',
            'fallback': True,
        }), 503

    except json.JSONDecodeError as e:
        logger.error(f"JSON parse error from Gemini: {e}")
        return jsonify({
            'success': False,
            'error': 'AI returned invalid format',
            'fallback': True,
        }), 502

    except Exception as e:
        logger.error(f"JD match error: {e}")
        return jsonify({
            'success': False,
            'error': str(e),
            'fallback': True,
        }), 500

# ─────────────────────────── CI/CD Sandbox ───────────────────────────

@infra_bp.route('/sandbox/latest', methods=['GET'])
def get_latest_sandbox():
    """Get the currently 'deployed' Sandbox message."""
    try:
        from utils.db_connect import DBConnect
        db = DBConnect().get_collection('sandbox_deployments')
        
        latest = db.find_one({'status': 'deployed'}, sort=[('timestamp', -1)])
        if latest:
            latest['_id'] = str(latest['_id'])
            
        return jsonify({'success': True, 'data': latest})
    except Exception as e:
        logger.error(f"Sandbox latest error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@infra_bp.route('/sandbox/deploy', methods=['POST'])
def trigger_sandbox_deploy():
    """Trigger a GitHub Action to deploy a new Sandbox message."""
    data = request.get_json()
    message = data.get('message', '').strip()
    color = data.get('color', 'text-primary')
    
    if not message or len(message) > 50:
        return jsonify({'success': False, 'error': 'Message must be between 1 and 50 characters'}), 400
        
    try:
        from utils.config import SandboxConfig
        import requests
        
        pat = SandboxConfig.GITHUB_PAT
        if not pat:
            return jsonify({'success': False, 'error': 'GitHub PAT not configured'}), 500
            
        headers = {
            'Authorization': f'token {pat}',
            'Accept': 'application/vnd.github.v3+json'
        }
        url = 'https://api.github.com/repos/Siddardha-23/portfolio/actions/workflows/sandbox.yml/dispatches'
        payload = {
            'ref': 'main',
            'inputs': {
                'message': message,
                'color': color
            }
        }
        r = requests.post(url, headers=headers, json=payload)
        if r.status_code != 204:
            return jsonify({'success': False, 'error': 'Failed to trigger GitHub Action', 'details': r.text}), 500
            
        from utils.db_connect import DBConnect
        db = DBConnect().get_collection('sandbox_deployments')
        doc = {
            'message': message,
            'color': color,
            'status': 'queued',
            'timestamp': datetime.utcnow()
        }
        result = db.insert_one(doc)
        doc['_id'] = str(result.inserted_id)
        
        return jsonify({'success': True, 'data': doc})
    except Exception as e:
        logger.error(f"Sandbox deploy error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@infra_bp.route('/sandbox/status', methods=['GET'])
def get_sandbox_status():
    """Poll the status of the latest Sandbox GitHub Action."""
    try:
        from utils.config import SandboxConfig
        import requests
        
        pat = SandboxConfig.GITHUB_PAT
        if not pat:
            return jsonify({'success': False, 'error': 'GitHub PAT not configured'}), 500
            
        headers = {
            'Authorization': f'token {pat}',
            'Accept': 'application/vnd.github.v3+json'
        }
        
        url = 'https://api.github.com/repos/Siddardha-23/portfolio/actions/workflows/sandbox.yml/runs?per_page=1'
        r = requests.get(url, headers=headers)
        if r.status_code != 200:
            return jsonify({'success': False, 'error': 'Failed to fetch workflow runs'}), 500
            
        runs_data = r.json()
        if not runs_data.get('workflow_runs'):
            return jsonify({'success': True, 'data': {'status': 'completed', 'jobs': []}})
            
        latest_run = runs_data['workflow_runs'][0]
        run_id = latest_run['id']
        run_status = latest_run['status']
        run_conclusion = latest_run['conclusion']
        
        jobs_url = latest_run['jobs_url']
        jobs_r = requests.get(jobs_url, headers=headers)
        if jobs_r.status_code != 200:
            return jsonify({'success': False, 'error': 'Failed to fetch jobs'}), 500
            
        jobs_data = jobs_r.json().get('jobs', [])
        
        response_data = {
            'status': run_status,
            'conclusion': run_conclusion,
            'run_id': run_id,
            'jobs': []
        }
        
        for job in jobs_data:
            job_info = {
                'name': job['name'],
                'status': job['status'],
                'conclusion': job['conclusion'],
                'steps': []
            }
            for step in job.get('steps', []):
                if step['name'] in ['Set up job', 'Complete job', 'Checkout']:
                    continue
                job_info['steps'].append({
                    'name': step['name'],
                    'status': step['status'],
                    'conclusion': step['conclusion']
                })
            response_data['jobs'].append(job_info)
            
        if run_status == 'completed' and run_conclusion == 'success':
            from utils.db_connect import DBConnect
            db = DBConnect().get_collection('sandbox_deployments')
            highest_queued = db.find_one({'status': 'queued'}, sort=[('timestamp', -1)])
            if highest_queued:
                db.update_one({'_id': highest_queued['_id']}, {'$set': {'status': 'deployed'}})
                
        return jsonify({'success': True, 'data': response_data})
    except Exception as e:
        logger.error(f"Sandbox status error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500
