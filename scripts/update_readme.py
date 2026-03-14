import os
import json
import re

def get_frontend_stack():
    try:
        with open('portfolio-frontend/package.json', 'r', encoding='utf-8') as f:
            data = json.load(f)
            deps = data.get('dependencies', {})
            dev_deps = data.get('devDependencies', {})
            
            stack = [
                f"- **React** ({deps.get('react', '').replace('^', '')})",
                f"- **TypeScript** ({dev_deps.get('typescript', '').replace('^', '')})",
                f"- **Vite** ({dev_deps.get('vite', '').replace('^', '')})",
                f"- **Tailwind CSS** ({dev_deps.get('tailwindcss', '').replace('^', '')})",
                f"- **Framer Motion** ({deps.get('framer-motion', '').replace('^', '')})",
                f"- **Three.js** ({deps.get('three', '').replace('^', '')})",
                f"- **React Query** ({deps.get('@tanstack/react-query', '').replace('^', '')})"
            ]
            return "\n".join(stack)
    except Exception as e:
        return f"Error reading frontend stack: {e}"

def get_backend_stack():
    try:
        with open('portfolio-backend/requirements.txt', 'r', encoding='utf-8') as f:
            lines = f.readlines()
            stack = []
            for line in lines:
                parts = line.strip().split('==')
                name = parts[0].lower()
                version = parts[1] if len(parts) > 1 else ""
                
                if name == 'flask':
                    stack.append(f"- **Flask** ({version})")
                elif name == 'flask-jwt-extended':
                    stack.append(f"- **JWT Auth** ({version})")
                elif name == 'google-genai' or name == 'google-generativeai':
                    stack.append("- **Gemini AI** (GenAI integration)")
                elif name == 'pymongo':
                    stack.append("- **MongoDB** (Database client)")
                elif name == 'aws-xray-sdk':
                    stack.append("- **AWS X-Ray** (Tracing SDK)")
                elif name == 'apig-wsgi':
                    stack.append("- **Mangum/WSGI** (Lambda adapter)")
            return "\n".join(stack)
    except Exception as e:
        return f"Error reading backend stack: {e}"

def get_project_structure():
    structure = "```text\nportfolio/\n"
    # Logic for structure remains mostly same but with encoding safety if needed
    for root, dirs, files in os.walk('.'):
        dirs[:] = [d for d in dirs if not d.startswith('.') and d not in ['node_modules', 'env', '__pycache__', 'dist', 'build', 'package', 'venv']]
        level = root.replace('.', '').count(os.sep)
        if level > 1: continue
        if root == '.': continue
        
        indent = '│   ' * (level - 1)
        subindent = '├── '
        structure += f"{indent}{subindent}{os.path.basename(root)}/\n"
        
        for f in files:
            if f in ['README.md', 'app.py', 'App.tsx', 'main.tf', 'package.json']:
                structure += f"{indent}│   ├── {f}\n"
    structure += "```"
    return structure

def update_readme():
    if not os.path.exists('README.md'):
        print("README.md not found.")
        return

    with open('README.md', 'r', encoding='utf-8') as f:
        content = f.read()

    frontend_stack = get_frontend_stack()
    backend_stack = get_backend_stack()
    structure = get_project_structure()
    
    # Update structures
    content = re.sub(r'## 📁 Project Structure\n\n```text.*?```', f'## 📁 Project Structure\n\n{structure}', content, flags=re.DOTALL)
    
    # Update Stack - targeting only the section under ## 🛠️ Tech Stack
    tech_stack_match = re.search(r'## 🛠️ Tech Stack\n\n### Frontend\n.*?\n\n### Backend\n.*?\n\n### Infrastructure', content, flags=re.DOTALL)
    if tech_stack_match:
        new_tech_stack = f"## 🛠️ Tech Stack\n\n### Frontend\n{frontend_stack}\n\n### Backend\n{backend_stack}\n\n### Infrastructure"
        content = content.replace(tech_stack_match.group(0), new_tech_stack)

    with open('README.md', 'w', encoding='utf-8') as f:
        f.write(content)

if __name__ == "__main__":
    update_readme()
    print("README updated successfully!")
