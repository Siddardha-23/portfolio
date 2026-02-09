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
      "Perfect 4.0 GPA",
      "Graduate Research Assistant",
      "Dean's List"
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
    title: "Cloud-Deployed Personal Portfolio",
    period: "December 2023 - March 2023",
    description: [
      "Developed and deployed a personal portfolio showcasing projects and skills, hosted on a 3-tier AWS architecture provisioned with Terraform, including VPC, EC2, RDS, and ECS services.",
      "Containerized the Flask backend and React frontend using Docker with Nginx as a reverse proxy, and automated deployment through CI/CD pipelines using CodePipeline, CodeCommit, and CloudFormation.",
      "Enabled real-time updates and seamless rollout of portfolio changes through automated pipeline triggers, improving deployment speed and reliability."
    ],
    technologies: ["AWS", "Terraform", "Docker", "Flask", "React", "Nginx", "CI/CD"]
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