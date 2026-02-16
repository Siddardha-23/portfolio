export const PERSONAL_INFO = {
  name: "Harshith Siddardha Manne",
  phone: "602-580-1838",
  email: "harshith.siddardha@gmail.com",
  linkedin: "linkedin.com/in/harshith-siddardha",
  github: "github.com/Siddardha-23",
  headline: "Cloud & DevOps Engineer | AWS | Multi-Cloud | Terraform | Distributed Systems",
  summary: "I build production-oriented cloud systems with a focus on scalability, cost optimization, security, and automation. Experience with multi-cloud integration (AWS, Azure, GCP), Infrastructure as Code, and containerized deployments. Master's in IT at ASU; seeking full-time opportunities starting May 2026.",
  summaryShort: "Building production-grade cloud systems. Focus on scalability, cost optimization, security, and automation. Multi-cloud (AWS, Azure, GCP) and IaC."
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
    institutionFull: "University College of Engineering, Kakinada(A), JNTU",
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
      link: "" // Add your credential link here
    },
    {
      name: "AWS Academy Graduate - Cloud Operations",
      issuer: "Amazon Web Services (AWS)",
      date: "Oct 2025",
      link: "" // Add your credential link here
    },
    {
      name: "AWS Academy Graduate - Cloud Architecting",
      issuer: "Amazon Web Services (AWS)",
      date: "Apr 2025",
      link: "" // Add your credential link here
    },
    {
      name: "AWS Cloud Quest: Cloud Practitioner",
      issuer: "Amazon Web Services (AWS)",
      date: "Dec 2024",
      link: "" // Add your credential link here
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
        text: "Trained extensively on Java, Spring, Spring Boot, and Reactive Spring Boot, React, React Native and successfully completed relevant assignments to solidify expertise.",
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
        text: "Automated Linux-based system maintenance and log parsing with Bash scripts, enhancing troubleshooting efficiency by 30%, while applying Agile and DevOps methodologies through active participation in sprints, reviews, and retrospectives.",
        category: "DevOps"
      }
    ],
    skills: ["Python", "Flask", "Docker", "AWS", "Bash", "Linux", "Agile"]
  }
];

export const PROJECTS = [
  {
    title: "Multi-Cloud Resume Screener",
    slug: "multi-cloud-resume-screener",
    period: "In Progress",
    status: "In Progress",
    description: [
      "A resume screening pipeline that uses Azure for file storage, AWS Textract for text extraction, and GCP Firestore/BigQuery for storage and analytics.",
      "Designed to demonstrate multi-cloud integration, service selection tradeoffs, and cost-efficient data flow across cloud providers."
    ],
    technologies: ["AWS Textract", "Azure Blob Storage", "GCP Firestore", "GCP BigQuery", "Python"],
    github: "https://github.com/Siddardha-23",
    problemStatement: "Parse and analyze resumes at scale using best-in-class services from multiple clouds while keeping data and cost under control.",
    architectureOverview: "File upload to Azure Blob; async processing triggers AWS Textract for OCR; extracted text and metadata stored in Firestore with analytics in BigQuery.",
    keyDecisions: [
      "AWS Textract for document text extraction (accuracy and API simplicity vs. Azure Form Recognizer).",
      "Firestore for flexible document storage and querying; BigQuery for analytics and reporting.",
      "Retry logic and dead-letter handling for failed extraction jobs."
    ],
    deploymentStrategy: "Planned: containerized workers, event-driven triggers, IaC for each cloud.",
    securityConsiderations: "IAM/least privilege per service; encrypted storage; no PII in logs.",
    futureImprovements: "Multi-region failover, cost alerts, and ML-based ranking layer.",
    architecture: {
      stack: {
        frontend: ["Upload UI (optional)", "Dashboard"],
        backend: ["Python", "Serverless/Workers"],
        infrastructure: ["Azure Blob Storage", "AWS Textract", "GCP Firestore", "GCP BigQuery", "IAM per cloud"],
        cicd: ["GitHub Actions", "Terraform (planned)"],
        monitoring: ["CloudWatch", "Stackdriver (planned)"]
      },
      diagram: {
        title: "Multi-Cloud Resume Screener",
        layers: [
          { name: "Ingest", color: "#0078D4", components: ["Azure Blob Storage", "Upload API", "Event trigger"] },
          { name: "Process", color: "#FF9900", components: ["AWS Textract", "Extraction worker", "Retry logic"] },
          { name: "Store & Analyze", color: "#4285F4", components: ["Firestore", "BigQuery", "Metadata pipeline"] }
        ]
      },
      security: ["IAM least-privilege per cloud", "Encryption at rest", "No PII in application logs"],
      scalability: ["Queue-based processing", "Serverless/auto-scaling workers", "BigQuery for large-scale analytics"],
      costEfficiency: ["Pay-per-use Textract", "Firestore/BigQuery tiering", "Lifecycle policies on Blob storage"],
      innovations: ["Multi-cloud choice per capability", "Clear separation of ingest, process, and analytics"]
    }
  },
  {
    title: "Desktop Employee Monitoring Application",
    slug: "desktop-monitoring-app",
    period: "Completed",
    status: "Completed",
    description: [
      "A desktop application for employee activity monitoring and reporting, built to demonstrate system design and secure local/network architecture.",
      "Includes activity tracking, reporting dashboards, and configurable policies."
    ],
    technologies: ["Python", "Desktop GUI", "Local DB", "Reporting"],
    github: "https://github.com/Siddardha-23",
    problemStatement: "Provide organizations with visibility into desktop usage while respecting privacy and security constraints.",
    architectureOverview: "Client agents on workstations report to a central service; data stored locally or in a central DB; dashboards for admins.",
    keyDecisions: [
      "Desktop-first design for reliability and offline capability.",
      "Configurable retention and privacy controls.",
      "Lightweight agent to minimize impact on user machines."
    ],
    deploymentStrategy: "Distributed installers; optional central server; manual or scripted rollout.",
    securityConsiderations: "Data encryption, access controls, audit logging, and compliance with organizational policies.",
    futureImprovements: "Cloud-backed optional sync, richer analytics, and cross-platform support.",
    architecture: {
      stack: {
        frontend: ["Desktop GUI", "Admin dashboard"],
        backend: ["Python", "Local/central DB"],
        infrastructure: ["Local storage", "Optional central server"],
        cicd: ["Manual/build scripts"],
        monitoring: ["Local logs", "Optional reporting"]
      },
      diagram: {
        title: "Desktop Monitoring Architecture",
        layers: [
          { name: "Agents", color: "#3B82F6", components: ["Desktop client", "Activity capture", "Local buffer"] },
          { name: "Service", color: "#10B981", components: ["Collector API", "Auth", "Config"] },
          { name: "Data & Reporting", color: "#8B5CF6", components: ["Database", "Reports", "Dashboard"] }
        ]
      },
      security: ["Encrypted data in transit and at rest", "Role-based access", "Audit logging"],
      scalability: ["Horizontal scaling of collector", "Efficient batching from agents"],
      costEfficiency: ["Minimal cloud dependency", "On-premise option"],
      innovations: ["Privacy-preserving defaults", "Configurable retention"]
    }
  },
  {
    title: "Smart Clipboard Manager",
    slug: "smart-clipboard-manager",
    period: "In Progress",
    status: "In Progress",
    description: [
      "A smart clipboard manager built with Python and Tkinter for local productivity. Tracks clipboard history, supports search, and organizes snippets.",
      "Ongoing development with plans for better search and optional cloud sync."
    ],
    technologies: ["Python", "Tkinter", "Local storage"],
    github: "https://github.com/Siddardha-23",
    problemStatement: "Improve productivity with a fast, searchable clipboard history that works offline and respects privacy.",
    architectureOverview: "Local desktop app; system tray integration; SQLite or file-based storage; Tkinter UI for history and search.",
    keyDecisions: [
      "Python + Tkinter for cross-platform desktop and rapid iteration.",
      "Local-first to ensure privacy and no dependency on network.",
      "Simple data model to allow future sync or AI features without rewrite."
    ],
    deploymentStrategy: "Local install; optional installer or portable build.",
    securityConsiderations: "Data stays on device; no telemetry; optional encryption for stored clips.",
    futureImprovements: "AI-powered search, optional encrypted cloud backup, plugins.",
    architecture: {
      stack: {
        frontend: ["Tkinter UI", "System tray"],
        backend: ["Python", "Clipboard hooks", "Local DB/file"],
        infrastructure: ["Local only"],
        cicd: ["Manual"],
        monitoring: ["Local logs"]
      },
      diagram: {
        title: "Smart Clipboard Manager",
        layers: [
          { name: "Input", color: "#3B82F6", components: ["System clipboard", "Hotkey capture"] },
          { name: "App", color: "#10B981", components: ["Python core", "Tkinter UI", "History manager"] },
          { name: "Storage", color: "#8B5CF6", components: ["SQLite / file", "Search index"] }
        ]
      },
      security: ["Local-only by default", "No telemetry", "Optional encryption at rest"],
      scalability: ["Efficient history limits", "Indexed search for large history"],
      costEfficiency: ["Zero cloud cost", "Low resource usage"],
      innovations: ["Extensible for future AI or sync features"]
    }
  },
  {
    title: "Cloud-Deployed Personal Portfolio",
    slug: "cloud-portfolio",
    period: "December 2024 - Present",
    status: "Live",
    description: [
      "Developed and deployed a personal portfolio showcasing projects and skills, hosted on a 3-tier AWS architecture provisioned with Terraform, including VPC, EC2, RDS, and ECS services.",
      "Containerized the Flask backend and React frontend using Docker with Nginx as a reverse proxy, and automated deployment through CI/CD pipelines using CodePipeline, CodeCommit, and CloudFormation.",
      "Enabled real-time updates and seamless rollout of portfolio changes through automated pipeline triggers, improving deployment speed and reliability.",
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

/** Categorized tech stack for clean listing (no skill bars / star ratings) */
export const TECH_STACK_CATEGORIES = {
  cloud: ["AWS", "Azure", "GCP"],
  infrastructureAsCode: ["Terraform", "CloudFormation"],
  languages: ["Python", "JavaScript", "SQL", "Bash", "HTML", "CSS"],
  tools: ["Docker", "Git", "GitHub", "Linux", "Nginx", "Flask", "Postgres"]
};