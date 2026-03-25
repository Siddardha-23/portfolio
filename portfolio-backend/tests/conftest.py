import copy
import pytest


@pytest.fixture
def original_resume():
    """A realistic parsed resume for test assertions."""
    return {
        "contact": {
            "name": "Alice Johnson",
            "email": "alice@example.com",
            "phone": "555-0100",
            "linkedin": "linkedin.com/in/alicejohnson",
            "github": "github.com/alicejohnson",
        },
        "summary": "Software engineer with 3 years of experience in backend systems.",
        "skills": {
            "Languages": ["Python", "JavaScript", "Go"],
            "Cloud": ["AWS", "Docker", "Kubernetes"],
        },
        "experience": [
            {
                "title": "Software Engineer",
                "company": "Acme Corp",
                "location": "San Francisco, CA",
                "dates": "Jan 2022 – Present",
                "type": "Full-time",
                "bullets": [
                    "Built microservices using Go and gRPC, reducing latency by 40%",
                    "Deployed applications on AWS ECS with Docker containers",
                ],
            },
            {
                "title": "Backend Intern",
                "company": "StartupXYZ",
                "location": "Remote",
                "dates": "May 2021 – Aug 2021",
                "type": "Internship",
                "bullets": [
                    "Developed REST APIs using Python Flask serving 1K+ daily users",
                ],
            },
        ],
        "education": [
            {
                "degree": "B.S. Computer Science",
                "institution": "UC Berkeley",
                "location": "Berkeley, CA",
                "dates": "Aug 2018 – May 2022",
                "gpa": "3.8",
                "coursework": "Data Structures, Algorithms, Distributed Systems",
            },
        ],
        "projects": [
            {
                "name": "CloudDeploy",
                "dates": "2021",
                "bullets": ["Automated AWS deployments with Terraform"],
                "tech": "Terraform, AWS, Python",
            },
        ],
    }


@pytest.fixture
def original_resume_no_projects(original_resume):
    """Original resume with zero projects."""
    r = copy.deepcopy(original_resume)
    r["projects"] = []
    return r


@pytest.fixture
def clean_tailored(original_resume):
    """A tailored resume with only mutable fields changed (bullets rewritten)."""
    r = copy.deepcopy(original_resume)
    r["experience"][0]["bullets"] = [
        "Engineered high-throughput microservices using Go and gRPC, cutting API latency by 40%",
        "Orchestrated containerized deployments on AWS ECS with Docker, achieving 99.9% uptime",
    ]
    r["summary"] = "Results-driven software engineer with 3+ years building scalable backend systems."
    return r


@pytest.fixture
def tampered_contact(original_resume):
    """Tailored resume where AI changed contact info."""
    r = copy.deepcopy(original_resume)
    r["contact"]["name"] = "Bob Smith"
    r["contact"]["email"] = "bob@fake.com"
    r["contact"]["phone"] = "555-9999"
    return r


@pytest.fixture
def tampered_experience_facts(original_resume):
    """Tailored resume where AI changed experience facts."""
    r = copy.deepcopy(original_resume)
    r["experience"][0]["company"] = "Google"
    r["experience"][0]["dates"] = "2019 – Present"
    r["experience"][0]["location"] = "Mountain View, CA"
    return r


@pytest.fixture
def tampered_education(original_resume):
    """Tailored resume where AI changed education facts."""
    r = copy.deepcopy(original_resume)
    r["education"][0]["institution"] = "MIT"
    r["education"][0]["degree"] = "Ph.D. Computer Science"
    r["education"][0]["gpa"] = "4.0"
    return r


@pytest.fixture
def hallucinated_experience(original_resume):
    """Tailored resume with an invented experience entry."""
    r = copy.deepcopy(original_resume)
    r["experience"].append({
        "title": "Senior Engineer",
        "company": "GoogleFake Inc",
        "location": "Mountain View, CA",
        "dates": "2020 – 2021",
        "type": "Full-time",
        "bullets": ["Led a team of 10 engineers building distributed systems"],
    })
    return r


@pytest.fixture
def dropped_experience(original_resume):
    """Tailored resume where AI dropped the second experience entry."""
    r = copy.deepcopy(original_resume)
    r["experience"] = [r["experience"][0]]
    return r


@pytest.fixture
def hallucinated_project(original_resume):
    """Tailored resume with an invented project (original had projects)."""
    r = copy.deepcopy(original_resume)
    r["projects"].append({
        "name": "FakeProject",
        "dates": "2023",
        "bullets": ["Built something that never existed"],
        "tech": "React, Node.js",
    })
    return r


@pytest.fixture
def excess_generated_projects(original_resume_no_projects):
    """Tailored resume with 3 projects when original had zero."""
    r = copy.deepcopy(original_resume_no_projects)
    r["projects"] = [
        {"name": "GenProject1", "dates": "2023", "bullets": ["..."], "tech": "React"},
        {"name": "GenProject2", "dates": "2023", "bullets": ["..."], "tech": "Node"},
        {"name": "GenProject3", "dates": "2023", "bullets": ["..."], "tech": "Go"},
    ]
    return r
