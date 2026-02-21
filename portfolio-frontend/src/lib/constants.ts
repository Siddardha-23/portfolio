export const PERSONAL_INFO = {
  name: "Harshith Siddardha Manne",
  phone: "602-580-1838",
  email: "harshith.siddardha@gmail.com",
  linkedin: "linkedin.com/in/harshith-siddardha",
  github: "github.com/Siddardha-23",
  summary: "Cloud & DevOps Professional graduating in May 2026, seeking full-time opportunities to apply expertise in cloud technologies, infrastructure management, and DevOps automation. Passionate about building scalable, secure solutions and contributing to impactful projects in a collaborative environment."
};

export const EDUCATION = [
  {
    degree: "Masters in Information Technology",
    institution: "Arizona State University",
    institutionFull: "Arizona State University, Ira A. Fulton Schools of Engineering",
    location: "Tempe, AZ, USA",
    period: "August 2024 - Present",
    gpa: 4.0,
    maxGpa: 4.0,
    gpaText: "4.0 / 4.0 GPA",
    status: "In Progress",
    campusImage: "/images/education/asu-campus.png",
    logo: "https://upload.wikimedia.org/wikipedia/en/a/a8/Arizona_State_University_seal.svg",
    coursework: [
      { name: "Principles of Computer Information and Technology", grade: "A" },
      { name: "Advanced Information Systems Security", grade: "A" },
      { name: "Information Systems Development", grade: "A" },
      { name: "Advanced Database Management Systems", grade: "A" },
      { name: "Security Compliance", grade: "A" },
      { name: "Cloud Architecture for IT", grade: "A" },
      { name: "Cloud Security and Ops for IT", grade: "A" },
      { name: "Network Forensics for IT", grade: "A" },
      { name: "Technology Innovation Lab", grade: "A" }
    ],
    achievements: [
      "Perfect 4.0 GPA"
    ],
    color: {
      primary: "#8C1D40",
      secondary: "#FFC627"
    }
  },
  {
    degree: "Bachelor's in Computer Science",
    institution: "JNTU Kakinada",
    institutionFull: "University College of Engineering, Kakinada (A), JNTU",
    location: "Kakinada, India",
    period: "2019 - May 2023",
    gpa: 3.7,
    maxGpa: 4.0,
    gpaText: "3.7 / 4.0 GPA",
    status: "Completed",
    campusImage: "/images/education/jntu-campus.png",
    logo: "https://upload.wikimedia.org/wikipedia/en/2/2f/JNTU_Kakinada_logo.png",
    coursework: [
      { name: "Data Structures & Algorithms", grade: "A" },
      { name: "Database Management Systems", grade: "A" },
      { name: "Computer Networks", grade: "A-" },
      { name: "Operating Systems", grade: "A" },
      { name: "Machine Learning", grade: "A-" }
    ],
    achievements: [
      "First Class with Distinction",
      "Technical Club Lead",
      "Best Project Award"
    ],
    color: {
      primary: "#0066CC",
      secondary: "#FFD700"
    }
  }
];

export const SKILLS = {
  programmingLanguages: ["Python", "Java", "Bash", "JavaScript", "SQL", "HTML", "CSS"],
  cloudDevOps: ["AWS (EC2, S3, VPC, ECS, Lambda, CloudWatch, CloudTrail, CodePipeline)", "Terraform", "CloudFormation", "Docker", "Nginx", "Git", "GitHub"],
  toolsAndDatabases: ["Flask", "Postgres", "CodeCommit", "Linux/Unix", "Windows"],
  certifications: [
    {
      name: "AWS Academy Graduate - Cloud Security Foundations",
      issuer: "Amazon Web Services (AWS)",
      date: "Oct 2025",
      link: ""
    },
    {
      name: "AWS Academy Graduate - Cloud Operations",
      issuer: "Amazon Web Services (AWS)",
      date: "Oct 2025",
      link: ""
    },
    {
      name: "AWS Academy Graduate - Cloud Architecting",
      issuer: "Amazon Web Services (AWS)",
      date: "Apr 2025",
      link: ""
    },
    {
      name: "AWS Cloud Quest: Cloud Practitioner",
      issuer: "Amazon Web Services (AWS)",
      date: "Dec 2024",
      link: ""
    }
  ]
};

export const EXPERIENCE = [
  {
    position: "Associate Data Scientist",
    company: "Deep Algorithms & Solutions",
    companyInitials: "DAS",
    location: "Hyderabad, India",
    period: "May 2023 - May 2024",
    duration: "1 year",
    type: "Full-time",
    companyColor: "#6366f1",
    impactMetrics: [
      { value: 45, label: "Deployment Efficiency", suffix: "%" },
      { value: 50, label: "System Scalability", suffix: "%" },
      { value: 99.9, label: "Uptime Achieved", suffix: "%" }
    ],
    responsibilities: [
      {
        text: "Architected and deployed secure, scalable 3-tier VPC infrastructure using Terraform and CloudFormation, integrating AWS services such as EC2, S3, ECS, ECR, CodePipeline, and CodeCommit for end-to-end CI/CD pipelines.",
        category: "Infrastructure"
      },
      {
        text: "Developed and containerized Python-Flask backend services using Docker; embedded Nginx within Docker containers for serving frontend assets and routing, then deployed to ECS with Fargate for scalability.",
        category: "Development"
      },
      {
        text: "Improved deployment efficiency by 45% through optimized Dockerfiles and streamlined ECS task definitions, enabling faster and more reliable releases across dev and prod environments.",
        category: "Optimization"
      },
      {
        text: "Ensured AWS Well-Architected Framework compliance by designing secure VPC architecture with IAM policies and CloudTrail auditing.",
        category: "Security"
      },
      {
        text: "Built PoC prototypes featuring autoscaling, multi-tier networking, and high-availability RDS, improving system scalability by 50%.",
        category: "Innovation"
      }
    ],
    skills: ["AWS", "Terraform", "Docker", "Flask", "CI/CD", "ECS", "CloudFormation"]
  },
  {
    position: "Associate Software Developer Intern",
    company: "Backflipt Xenovous, Inc.",
    companyInitials: "BX",
    location: "Hyderabad, India",
    period: "January 2023 - April 2023",
    duration: "4 months",
    type: "Internship",
    companyColor: "#10b981",
    impactMetrics: [
      { value: 40, label: "Dev Workflow Improvement", suffix: "%" },
      { value: 5, label: "Technologies Mastered", suffix: "+" },
      { value: 100, label: "Assignments Completed", suffix: "%" }
    ],
    responsibilities: [
      {
        text: "Trained extensively on Java, Spring, Spring Boot, Reactive Spring Boot, React, and React Native, successfully completing relevant assignments to solidify expertise.",
        category: "Learning"
      },
      {
        text: "Worked as a backend developer on the International Data Corporation project, focusing on backend architecture and development.",
        category: "Development"
      },
      {
        text: "Utilized Reactive Spring Boot to develop responsive and scalable applications, enhancing system performance and reliability.",
        category: "Optimization"
      },
      {
        text: "Supported React Native development team by debugging and resolving issues, contributing to a smoother development workflow, and ensuring efficient application performance.",
        category: "Development"
      },
      {
        text: "Collaborated with senior developers to implement key React Native features such as state management with Redux, navigation with React Navigation, and integration of native modules, enhancing the application's functionality and improving user experience.",
        category: "Innovation"
      }
    ],
    skills: ["Java", "Spring Boot", "Reactive Spring", "React", "React Native", "Redux", "Backend Development"]
  },
  {
    position: "Data Science Intern",
    company: "Deep Algorithms & Solutions",
    companyInitials: "DAS",
    location: "Hyderabad, India",
    period: "January 2021 - May 2022",
    duration: "1 year 5 months",
    type: "Internship",
    companyColor: "#6366f1",
    impactMetrics: [
      { value: 15, label: "AWS Services Explored", suffix: "+" },
      { value: 30, label: "Efficiency Improvement", suffix: "%" }
    ],
    responsibilities: [
      {
        text: "Completed intensive training in Python and Flask development, transitioning into DevOps tasks involving CI/CD, Docker, and AWS deployments.",
        category: "Learning"
      },
      {
        text: "Automated deployment of Flask applications to EC2 and ECS environments, using Docker and manual CI processes to validate application readiness.",
        category: "Automation"
      },
      {
        text: "Explored 15+ AWS services including CodeCommit, S3, CloudWatch, and CloudFormation; built mini-projects to demonstrate hands-on competency across cloud lifecycle.",
        category: "Exploration"
      },
      {
        text: "Automated Linux-based system maintenance and log parsing with Bash scripts, enhancing troubleshooting efficiency by 30%. Applied Agile and DevOps methodologies through active participation in sprints, reviews, and retrospectives.",
        category: "DevOps"
      }
    ],
    skills: ["Python", "Flask", "Docker", "AWS", "Bash", "Linux", "Agile"]
  }
];

export const PROJECTS = [
  {
    title: "Cybersecurity in Connected Aviation – AEROSEC",
    slug: "aerosec",
    period: "August 2025 - December 2025",
    status: "Live",
    description: [
      "Led a Honeywell-guided innovation project targeting aviation's most exposed attack surface — third-party integrations connecting Passenger Service Systems (PSS), payment processors, loyalty programs, and booking APIs.",
      "Conducted 20+ stakeholder interviews with FAA officials, Air France–KLM, Delta, cybersecurity engineers, and IT security leaders, validating that passenger-facing systems face more frequent attacks than avionics, with 60%+ of breaches involving third-party or API exposure.",
      "Developed AEROSEC — a real-time vendor cyber risk dashboard with AI-driven anomaly detection, automated compliance scoring aligned with NIST CSF 2.0, ISO 27001, DO-326A, and executive-level risk-to-revenue impact mapping.",
      "Built comprehensive business validation including TAM–SAM–SOM analysis ($200B → $15B → $2B), SaaS tiered pricing, 5-year financial projection, and go-to-market roadmap for airline and travel technology segments.",
      "Evolved from a DevOps engineering mindset to a systems-oriented cybersecurity strategist — framing security as business resilience and connecting technical controls to revenue protection and executive decision-making."
    ],
    technologies: ["Cybersecurity", "NIST CSF 2.0", "API Security", "AI/ML", "Aviation", "Risk Analytics"],
    github: "https://github.com/Siddardha-23",
    architecture: {
      stack: {
        frontend: ["Executive Dashboard", "Real-time Risk Visualizations", "Compliance Scorecards"],
        backend: ["AI/ML Anomaly Detection Engine", "Vendor Risk Scoring API", "Audit Log Generator"],
        infrastructure: ["Real-time API Monitoring", "PSS Integration Layer", "Threat Intelligence Feeds"],
        cicd: ["Automated Compliance Reports", "Continuous Vendor Assessment", "NIST CSF Alignment"],
        monitoring: ["MTTD/MTTR Tracking", "API Health Monitoring", "Business Impact Scoring"]
      },
      diagram: {
        title: "AEROSEC — Real-Time Third-Party Vendor Cyber Risk Platform",
        layers: [
          {
            name: "Data Ingestion",
            color: "#F59E0B",
            components: [
              "Real-time PSS API monitoring",
              "Third-party vendor data feeds",
              "Threat intelligence integration",
              "Booking & payment system telemetry"
            ]
          },
          {
            name: "Analysis Engine",
            color: "#8B5CF6",
            components: [
              "AI-driven anomaly detection",
              "Vendor risk scoring (NIST/FAA-aligned)",
              "BOLA vulnerability detection",
              "Compliance gap analysis"
            ]
          },
          {
            name: "Risk Intelligence",
            color: "#10B981",
            components: [
              "Executive risk dashboard",
              "Cyber risk → business impact mapping",
              "Auto-generated audit reports",
              "Real-time compliance scoring"
            ]
          }
        ]
      },
      security: [
        "Aligned with NIST CSF 2.0 (Govern, Identify, Protect, Detect, Respond, Recover)",
        "ISO/IEC 27001 Information Security Management System compliance",
        "DO-326A Airworthiness Security Risk Assessment methodology",
        "DO-355 Security Assurance and Validation processes",
        "Privacy by Design principles embedded in architecture",
        "BOLA and API-specific vulnerability detection",
        "Supply chain risk management for third-party vendors",
        "Real-time threat detection and automated incident response"
      ],
      scalability: [
        "Supports monitoring across hundreds of third-party API integrations",
        "Modular architecture scales from regional to major international carriers",
        "SaaS multi-tenant design enables rapid customer onboarding",
        "AI models continuously improve with expanded threat telemetry",
        "Extensible framework for new compliance standards and regulations",
        "Cloud-native deployment for global availability"
      ],
      costEfficiency: [
        "Average data breach costs ~$4.4M globally, >$10M in the US (IBM)",
        "Reduces Mean Time to Detect (MTTD) and Mean Time to Respond (MTTR)",
        "Prevents revenue leakage from booking errors and integration failures",
        "Automated compliance reporting reduces manual audit costs",
        "Early threat detection prevents cascading operational disruptions",
        "ROI through reduced regulatory fines and brand damage avoidance"
      ],
      innovations: [
        "First-of-kind focus on third-party PSS API risk in aviation",
        "AI-driven anomaly detection tailored to aviation integration patterns",
        "Maps cyber risk directly to business revenue impact",
        "Bridges gap between technical security teams and executive decision-makers",
        "Customer discovery-driven design validated with 20+ industry stakeholders",
        "Integrates regulatory compliance as a competitive differentiator"
      ]
    }
  },
  {
    title: "AWS CI/CD Microservices Architecture",
    slug: "aws-microservices-cicd",
    period: "January 2025 - May 2025",
    status: "Live",
    description: [
      "Designed and deployed a fully automated microservices architecture on AWS using a 3-tier VPC model with public, private application, and private data subnets across multiple Availability Zones, provisioned entirely through CloudFormation.",
      "Implemented 4 containerized ECS Fargate services (Frontend, Backend, AI Service, Third-party API) with ALB listener routing, tiered security group isolation, and NAT Gateway for controlled private subnet outbound access.",
      "Built end-to-end CI/CD pipeline using CodeCommit, EventBridge, CodePipeline, CodeBuild, and ECR with branch-based deployments, immutable Docker images, and zero-touch production rollouts via rolling ECS updates.",
      "Enforced defense-in-depth security with chained security groups (ALB → Frontend → Backend → RDS), private-only RDS access restricted to Backend and AI service SGs, ACM-managed SSL/TLS, and no public database endpoints.",
      "Architected for high availability with multi-AZ deployments, ECS rolling updates, ALB health checks, and full Infrastructure-as-Code reproducibility — aligned with the AWS Well-Architected Framework."
    ],
    technologies: ["AWS", "ECS", "CloudFormation", "Docker", "CI/CD", "RDS"],
    github: "https://github.com/Siddardha-23",
    architecture: {
      stack: {
        frontend: ["React", "Nginx", "ECS Fargate (Public Tier)"],
        backend: ["Backend API (ECS)", "AI Service (ECS)", "Third-party API Service (ECS)"],
        infrastructure: ["3-Tier VPC", "Multi-AZ Subnets", "NAT Gateway", "ALB", "Route 53", "ACM"],
        cicd: ["CloudFormation (IaC)", "CodeCommit", "EventBridge", "CodePipeline", "CodeBuild", "ECR"],
        monitoring: ["CloudWatch Logs", "ECS Service Metrics", "ALB Health Checks"]
      },
      diagram: {
        title: "Fully Automated AWS Microservices CI/CD Architecture",
        layers: [
          {
            name: "CI/CD Pipeline",
            color: "#F59E0B",
            components: [
              "CodeCommit branch-based source control",
              "EventBridge commit event detection",
              "CodePipeline multi-stage orchestration",
              "CodeBuild Docker image builds with Nginx",
              "ECR immutable image storage",
              "S3 build artifact storage"
            ]
          },
          {
            name: "Public Tier",
            color: "#8B5CF6",
            components: [
              "Application Load Balancer (ALB)",
              "Route 53 DNS routing",
              "ACM SSL/TLS certificate validation",
              "Frontend ECS Fargate service"
            ]
          },
          {
            name: "Private Application Tier",
            color: "#3B82F6",
            components: [
              "Backend ECS Fargate service",
              "AI Service (ECS Fargate)",
              "Third-party API integration service",
              "Security group isolated communication"
            ]
          },
          {
            name: "Private Data Tier",
            color: "#10B981",
            components: [
              "Amazon RDS in private subnets",
              "Access restricted to Backend & AI SGs only",
              "No public accessibility",
              "Multi-AZ deployment for high availability"
            ]
          }
        ]
      },
      security: [
        "3-tier VPC isolation: public, private app, and private data subnets (WAF: Security Pillar)",
        "Security group chaining: ALB → Frontend → Backend → RDS",
        "RDS access restricted to Backend & AI Service security groups only",
        "No public database endpoints — RDS deployed exclusively in private subnets",
        "NAT Gateway for controlled outbound access from private subnets",
        "ACM-managed SSL/TLS certificates with Route 53 DNS validation",
        "IAM least-privilege roles for ECS task execution",
        "Immutable Docker images — no runtime mutations, full audit trail"
      ],
      scalability: [
        "ECS Fargate auto-scales each microservice independently (WAF: Performance Efficiency)",
        "ALB distributes traffic across multiple Availability Zones (WAF: Reliability)",
        "Multi-AZ RDS deployment for database high availability and failover",
        "Stateless container design enables horizontal scaling without session affinity",
        "Rolling ECS updates ensure zero-downtime deployments",
        "Branch-based environments support parallel development workflows"
      ],
      costEfficiency: [
        "Fargate pay-per-task eliminates idle EC2 compute costs (WAF: Cost Optimization)",
        "NAT Gateway shared across private subnets to minimize data transfer charges",
        "CloudFormation IaC eliminates manual provisioning overhead and drift",
        "Fully automated CI/CD reduces deployment labor and human error costs",
        "Branch-based environments prevent resource conflicts and staging bottlenecks",
        "ECR lifecycle policies automatically manage image storage costs"
      ],
      innovations: [
        "End-to-end automation: git push to production with zero manual steps (WAF: Operational Excellence)",
        "EventBridge-driven pipeline triggers replace polling with event-driven architecture",
        "Infrastructure as Code: entire stack reproducible from CloudFormation templates",
        "Image immutability guarantees deployment consistency across environments",
        "4 independent microservices with isolated scaling, deployment, and failure domains",
        "Defense-in-depth security model fully aligned with AWS Well-Architected Framework"
      ]
    }
  },
  {
    title: "Cross-Account CI/CD Multi-Tenancy Architecture",
    slug: "cross-account-cicd",
    period: "March 2025 - May 2025",
    status: "Live",
    description: [
      "Designed a cross-account CI/CD pipeline architecture enabling centralized build in a main DevOps account with automated deployment to multiple isolated tenant AWS accounts, fully provisioned through CloudFormation.",
      "Implemented multi-stage CodePipeline with per-tenant deployment stages — each tenant account operates its own ECS Fargate services, 3-tier VPC, and RDS, configured via environment-specific parameters and task definition variables.",
      "Configured cross-account ECR access through IAM inline policies allowing tenant ECS tasks to pull Docker images from the main account's shared registry, with KMS-encrypted artifact sharing via S3 for secure cross-boundary data transfer.",
      "Built for horizontal tenant scalability — adding a new tenant requires only a new pipeline stage and deploying the CloudFormation stack to the target account, with zero impact to existing tenants.",
      "Enforced account-level blast radius isolation: each tenant runs in a fully independent AWS account with its own VPC, security groups, and RDS instance, preventing cross-tenant data leakage or failure propagation."
    ],
    technologies: ["AWS", "CloudFormation", "ECS", "Docker", "CI/CD", "RDS"],
    github: "https://github.com/Siddardha-23",
    architecture: {
      stack: {
        frontend: ["React", "Nginx", "ECS Fargate (per tenant)"],
        backend: ["Backend API (ECS)", "AI Service (ECS)", "Third-party API Service (ECS)"],
        infrastructure: ["Cross-Account IAM Roles", "3-Tier VPC per Tenant", "NAT Gateway", "ALB", "RDS per Tenant", "KMS Encryption"],
        cicd: ["CloudFormation (IaC)", "CodeCommit", "EventBridge", "CodePipeline (multi-stage)", "CodeBuild", "ECR (shared)", "S3 (KMS-encrypted)"],
        monitoring: ["CloudWatch Logs", "Cross-Account CloudWatch", "ECS Service Metrics", "ALB Health Checks"]
      },
      diagram: {
        title: "Cross-Account CI/CD Multi-Tenancy Architecture",
        layers: [
          {
            name: "Main Account — CI/CD Pipeline",
            color: "#F59E0B",
            components: [
              "CodeCommit branch-based source control",
              "EventBridge commit event detection",
              "CodePipeline with per-tenant deployment stages",
              "CodeBuild Docker image builds",
              "ECR shared image registry (cross-account access)",
              "S3 build artifacts encrypted with KMS"
            ]
          },
          {
            name: "Cross-Account Access Layer",
            color: "#8B5CF6",
            components: [
              "IAM inline policies for ECR pull from tenant accounts",
              "Cross-account IAM assume-role for CodePipeline deployment",
              "KMS key policy for cross-account artifact decryption",
              "imagedetail.json artifact for image URI propagation"
            ]
          },
          {
            name: "Tenant Account — Compute & Network",
            color: "#10B981",
            components: [
              "Independent 3-tier VPC per tenant (public, private app, private data)",
              "ECS Fargate services pulling from main account ECR",
              "ALB with Route 53 DNS and ACM SSL/TLS per tenant",
              "NAT Gateway for private subnet outbound access"
            ]
          },
          {
            name: "Tenant Account — Data Tier",
            color: "#3B82F6",
            components: [
              "Amazon RDS in private subnets per tenant",
              "Environment-specific configuration via ECS task parameters",
              "Security group isolation (Backend & AI SG → RDS only)",
              "Multi-AZ deployment for tenant-level high availability"
            ]
          }
        ]
      },
      security: [
        "Account-level blast radius isolation — each tenant in a separate AWS account",
        "Cross-account ECR access via scoped IAM inline policies (least privilege)",
        "KMS-encrypted S3 artifacts with cross-account key policies",
        "No shared databases — each tenant has its own RDS in private subnets",
        "Security group chaining within each tenant: ALB → Frontend → Backend → RDS",
        "CodePipeline uses assume-role for cross-account deployment (no long-lived credentials)",
        "Immutable Docker images shared from centralized ECR registry",
        "CloudFormation drift detection ensures infrastructure consistency"
      ],
      scalability: [
        "Add new tenants by adding pipeline stages + deploying CloudFormation stack",
        "Zero impact to existing tenants when onboarding new accounts",
        "Each tenant independently scales ECS services based on own traffic",
        "Multi-AZ RDS per tenant for independent database high availability",
        "Shared ECR registry scales image distribution across all tenant accounts",
        "Branch-based pipeline supports parallel development across environments"
      ],
      costEfficiency: [
        "Centralized build pipeline — single CodeBuild project serves all tenants",
        "Shared ECR registry eliminates per-tenant image build redundancy",
        "Fargate pay-per-task in each tenant — no idle compute across accounts",
        "CloudFormation IaC enables repeatable tenant provisioning in minutes",
        "KMS key sharing reduces per-tenant encryption overhead",
        "Account-level cost attribution via AWS Organizations for chargeback"
      ],
      innovations: [
        "True multi-tenancy with AWS account-level isolation (strongest isolation boundary)",
        "Single pipeline deploys to N tenants — linear stage addition, not pipeline duplication",
        "Cross-account image sharing with encrypted artifact propagation",
        "Environment-specific ECS task parameters eliminate per-tenant code branches",
        "CloudFormation parameterized stacks: one template, many tenants",
        "Production-grade multi-tenancy pattern used by SaaS platforms at scale"
      ]
    }
  },
  {
    title: "Cloud-Deployed Personal Portfolio",
    slug: "cloud-portfolio",
    period: "December 2024 - Present",
    status: "Live",
    description: [
      "Designed and deployed a full-stack portfolio on a 3-tier serverless AWS architecture — React SPA on S3/CloudFront, Flask API on Lambda via API Gateway, and MongoDB Atlas for data persistence, all provisioned with Terraform.",
      "Built automated CI/CD pipelines using GitHub Actions for continuous deployment, with S3 static hosting, CloudFront cache invalidation, and Lambda function updates on every push.",
      "Implemented visitor analytics with fingerprint-based deduplication, session tracking, organization detection, and real-time engagement metrics.",
      "Implemented visitor tracking with fingerprinting, session management, and organization detection for analytics.",
      "Applied AWS Well-Architected Framework principles for security, cost optimization, and operational excellence."
    ],
    technologies: ["AWS", "Terraform", "Docker", "Flask", "React", "Nginx", "CI/CD"],
    github: "https://github.com/Siddardha-23/portfolio",
    architecture: {
      stack: {
        frontend: ["React 18", "TypeScript", "Tailwind CSS", "Vite", "Framer Motion"],
        backend: ["Python 3.12", "Flask", "MongoDB Atlas", "Mangum (ASGI adapter)"],
        infrastructure: ["AWS Lambda", "API Gateway", "S3 + CloudFront", "Route 53", "ACM (SSL/TLS)"],
        cicd: ["GitHub Actions", "AWS CodePipeline", "Terraform", "Docker"],
        monitoring: ["CloudWatch Logs", "CloudWatch Alarms", "CloudTrail"]
      },
      diagram: {
        title: "3-Tier Serverless Architecture",
        layers: [
          {
            name: "Presentation Layer",
            color: "#3B82F6",
            components: [
              "React SPA hosted on S3",
              "CloudFront CDN (global edge caching)",
              "Route 53 DNS with SSL/TLS via ACM",
              "Custom domain with HTTPS enforcement"
            ]
          },
          {
            name: "Application Layer",
            color: "#8B5CF6",
            components: [
              "API Gateway (REST API with throttling)",
              "AWS Lambda (Python Flask via Mangum)",
              "JWT-based authentication",
              "Rate limiting & input sanitization"
            ]
          },
          {
            name: "Data Layer",
            color: "#10B981",
            components: [
              "MongoDB Atlas (managed NoSQL)",
              "Visitor tracking & analytics collections",
              "Session management with TTL indexes",
              "IP geolocation caching"
            ]
          }
        ]
      },
      security: [
        "HTTPS everywhere with ACM-managed SSL/TLS certificates",
        "API Gateway throttling to prevent DDoS and abuse",
        "JWT-based authentication for protected endpoints",
        "Input sanitization against XSS and NoSQL injection",
        "CORS origin restriction to known domains only",
        "Rate limiting on sensitive endpoints (contact, registration)",
        "IAM least-privilege roles for Lambda execution",
        "CloudTrail audit logging for all API calls",
        "Bcrypt password hashing for admin authentication"
      ],
      scalability: [
        "Serverless Lambda auto-scales from 0 to thousands of concurrent requests",
        "CloudFront CDN caches static assets at 400+ edge locations worldwide",
        "API Gateway handles burst traffic with configurable throttling",
        "MongoDB Atlas auto-scales storage and compute independently",
        "S3 provides virtually unlimited static asset storage",
        "Stateless architecture enables horizontal scaling without session affinity"
      ],
      costEfficiency: [
        "Lambda pay-per-invocation: $0 cost at idle, pennies under moderate traffic",
        "S3 + CloudFront: fraction of a cent per GB for static hosting",
        "No always-on EC2 instances eliminates idle compute costs",
        "MongoDB Atlas free tier for development, pay-as-you-grow for production",
        "Estimated monthly cost under moderate traffic: < $5/month",
        "CloudFront caching reduces Lambda invocations by 80%+"
      ],
      coldStartOptimization: [
        "Provisioned Concurrency configured for critical Lambda functions",
        "Lightweight Flask application with lazy-loaded dependencies",
        "Mangum ASGI adapter enables efficient request handling",
        "Python 3.12 runtime with optimized startup performance",
        "Minimized deployment package size (~15MB) for faster cold starts",
        "Connection pooling for MongoDB to avoid reconnection overhead",
        "API Gateway caching for frequently accessed endpoints"
      ]
    }
  },
  {
    title: "Ephemeral Test Environments (SLATE)",
    slug: "slate-environments",
    period: "January 2025 - Present",
    status: "In Progress",
    description: [
      "Building a system that automatically creates ephemeral test environments for every new feature branch or pull request, mirroring production infrastructure.",
      "CI/CD pipeline (GitHub Actions) triggers Infrastructure-as-Code (Terraform) to provision isolated environments with containerized Python/Flask app, database, and required services.",
      "Teams can test features in short-lived, production-like environments, then automatically tear them down when the PR is merged or closed.",
      "Implements a web dashboard/API for requesting, monitoring, and managing ephemeral environments in real-time.",
      "Showcases GitOps principles by tying infrastructure provisioning to Git events, eliminating shared staging bottlenecks."
    ],
    technologies: ["AWS", "Terraform", "Docker", "Flask", "CI/CD", "ECS", "GitHub Actions"],
    github: "https://github.com/Siddardha-23",
    architecture: {
      stack: {
        frontend: ["React", "TypeScript", "Dashboard UI"],
        backend: ["Python 3.12", "Flask", "REST API", "Webhook handlers"],
        infrastructure: ["AWS ECS/EKS", "RDS", "S3", "VPC", "ALB", "IAM", "CodePipeline", "CodeBuild"],
        cicd: ["GitHub Actions", "AWS CodePipeline", "CodeBuild", "Terraform", "Docker"],
        monitoring: ["CloudWatch", "Container Insights", "Custom Dashboard"]
      },
      diagram: {
        title: "SLATE Ephemeral Environment Architecture",
        layers: [
          {
            name: "Git & CI/CD Trigger Layer",
            color: "#F59E0B",
            components: [
              "GitHub repository with PR/branch webhooks",
              "GitHub Actions workflow triggers on PR events",
              "AWS CodePipeline orchestrates multi-stage deployment",
              "AWS CodeBuild compiles, tests, and builds Docker images",
              "Event-driven triggers for create/update/destroy lifecycle"
            ]
          },
          {
            name: "Infrastructure Provisioning Layer",
            color: "#8B5CF6",
            components: [
              "Terraform modules for per-environment infrastructure",
              "Isolated VPC or Kubernetes namespace per feature branch",
              "Application Load Balancer with unique URL per environment",
              "ECS Fargate tasks for containerized application deployment",
              "RDS instance or containerized database per environment",
              "IAM roles with least-privilege per-environment access"
            ]
          },
          {
            name: "Application & Services Layer",
            color: "#3B82F6",
            components: [
              "Dockerized Python/Flask application per branch",
              "Isolated database with seeded test data",
              "S3 buckets for environment-specific assets",
              "Environment-specific secrets via AWS Secrets Manager",
              "Unique subdomain URL routed via ALB rules"
            ]
          },
          {
            name: "Management & Dashboard Layer",
            color: "#10B981",
            components: [
              "Flask-based web dashboard for environment monitoring",
              "REST API for manual environment start/stop/extend",
              "Real-time status of all active environments",
              "Terraform output integration (URLs, credentials, logs)",
              "Automatic cleanup on PR merge or close event"
            ]
          }
        ]
      },
      security: [
        "Each environment gets its own isolated VPC or Kubernetes namespace",
        "Network segregation prevents cross-environment communication",
        "IAM role per environment with least-privilege access policies",
        "Ephemeral credentials via AWS Secrets Manager (auto-rotated)",
        "Security groups restrict access to authorized team members only",
        "All IaC changes are code-reviewed before provisioning",
        "CloudTrail logging for audit trail of all resource operations",
        "Automatic resource destruction prevents orphaned infrastructure"
      ],
      scalability: [
        "Supports dozens of concurrent ephemeral environments",
        "ECS Fargate auto-scales application containers per environment",
        "Modular Terraform enables adding services without refactoring",
        "Event-driven architecture scales with PR volume",
        "ALB routing rules dynamically manage environment endpoints",
        "Namespace isolation in Kubernetes enables dense packing"
      ],
      costEfficiency: [
        "Environments exist only for the lifetime of a PR (hours to days)",
        "Automatic teardown on merge/close eliminates forgotten resources",
        "No always-on staging servers reduces cloud spend by 60-80%",
        "Spot instances for non-critical test workloads",
        "Resource tagging enables per-feature cost attribution",
        "Terraform state management prevents resource drift and waste"
      ],
      innovations: [
        "Mirrors practices used at elite tech companies (e.g., Uber's SLATE)",
        "Eliminates 'works on my machine' issues with production-like environments",
        "Reduces staging bottlenecks that slow release velocity",
        "Enables parallel feature testing without environment conflicts",
        "Git-driven infrastructure: merge triggers both code and infra deployment",
        "Demonstrates platform engineering and environment-as-a-service concepts"
      ]
    }
  }
];

export const ROLES = [
  "Cloud & DevOps Engineer",
  "AWS Solutions Architect",
  "Infrastructure Automation Specialist",
  "CI/CD Pipeline Expert",
  "Site Reliability Engineer",
  "Full-Stack Developer"
];