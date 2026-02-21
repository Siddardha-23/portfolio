import { useState, useEffect, useRef, KeyboardEvent, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import WelcomeForm from '@/components/WelcomeForm';
import { motion } from 'framer-motion';
import { FaAws, FaDocker, FaLinux, FaPython, FaGitAlt, FaJenkins, FaTerminal, FaReact } from 'react-icons/fa';
import { SiKubernetes, SiTerraform, SiAnsible, SiGrafana, SiPrometheus, SiApachekafka, SiNginx, SiRedis } from 'react-icons/si';
import { useVisitorTracking } from '@/hooks/useVisitorTracking';
import { ThemeToggle } from '@/components/theme-toggle';

const PORTFOLIO_VISITED_KEY = 'portfolio_visited';

// All command names for tab completion
const COMMAND_NAMES = ['help', 'whoami', 'ls', 'cat', 'clear', 'skill', 'explore', 'about', 'date', 'neofetch', 'uptime', 'docker', 'terraform'];
// Files available for `cat`
const FILE_NAMES = ['skills.txt', 'projects.json', 'about.md', 'experience.log', 'certs.yaml'];
// Skills available for `skill`
const SKILL_NAMES = ['aws', 'terraform', 'docker', 'python', 'cloudformation', 'cicd', 'flask', 'linux'];

export default function Welcome() {
  const [terminalText, setTerminalText] = useState<string[]>([]);
  const [userInput, setUserInput] = useState('');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [tabCycleIndex, setTabCycleIndex] = useState(-1);
  const [tabBase, setTabBase] = useState('');
  const navigate = useNavigate();
  const terminalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [shouldRedirect] = useState(
    () => typeof window !== 'undefined' && !!localStorage.getItem(PORTFOLIO_VISITED_KEY)
  );
  useEffect(() => {
    if (shouldRedirect) navigate('/home', { replace: true });
  }, [shouldRedirect, navigate]);

  // Track visitor immediately on page load
  useVisitorTracking('welcome-page');

  if (shouldRedirect) return null;

  // Focus the hidden input whenever user clicks anywhere on the terminal
  const focusTerminal = () => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  // Available commands and their outputs
  const availableCommands: Record<string, (args?: string) => string> = {
    help: () =>
      "Available commands:\n" +
      "  help            - Show available commands\n" +
      "  whoami          - Display current user\n" +
      "  ls              - List directory contents\n" +
      "  cat [file]      - Display file contents\n" +
      "  skill [name]    - Skill proficiency details\n" +
      "  about           - About Harshith\n" +
      "  neofetch        - System information\n" +
      "  uptime          - Portfolio uptime & status\n" +
      "  docker ps       - Running project services\n" +
      "  terraform plan  - Infrastructure overview\n" +
      "  date            - Current date/time\n" +
      "  clear           - Clear the terminal\n" +
      "  explore         - Continue to portfolio\n\n" +
      "Shortcuts: Tab = autocomplete, Ctrl+L = clear, Ctrl+C = cancel, \u2191/\u2193 = history",

    whoami: () => "prospective-employer",

    ls: () =>
      "skills.txt  projects.json  about.md  experience.log  certs.yaml",

    cat: (args) => {
      if (!args) return "Usage: cat [file]\nAvailable files: " + FILE_NAMES.join(", ");
      const file = args.trim();

      if (file === "skills.txt") {
        return "\u2022 Languages:    Python | Java | Bash | JavaScript | SQL\n" +
          "\u2022 Cloud:        AWS (EC2, S3, Lambda, ECS, VPC, CloudWatch)\n" +
          "\u2022 IaC:          Terraform | CloudFormation\n" +
          "\u2022 Containers:   Docker | ECS Fargate | Nginx\n" +
          "\u2022 CI/CD:        CodePipeline | GitHub Actions | CodeBuild\n" +
          "\u2022 Tools:        Flask | Git | Linux/Unix | PostgreSQL";
      }

      if (file === "projects.json") {
        return '{\n' +
          '  "projects": [\n' +
          '    {\n' +
          '      "name": "AEROSEC — Aviation Cybersecurity Platform",\n' +
          '      "tech": ["NIST CSF 2.0", "API Security", "AI/ML", "Risk Analytics"]\n' +
          '    },\n' +
          '    {\n' +
          '      "name": "AWS CI/CD Microservices Architecture",\n' +
          '      "tech": ["ECS Fargate", "CodePipeline", "CloudFormation", "Docker"]\n' +
          '    },\n' +
          '    {\n' +
          '      "name": "Cross-Account CI/CD Multi-Tenancy",\n' +
          '      "tech": ["AWS", "KMS", "ECR", "CloudFormation"]\n' +
          '    },\n' +
          '    {\n' +
          '      "name": "Cloud-Deployed Portfolio",\n' +
          '      "tech": ["Lambda", "S3", "CloudFront", "Terraform"]\n' +
          '    }\n' +
          '  ]\n' +
          '}';
      }

      if (file === "about.md") {
        return "# Harshith Siddardha Manne\n\n" +
          "Cloud & DevOps Engineer passionate about building resilient, scalable\n" +
          "infrastructure and optimizing development workflows.\n\n" +
          "MS in Information Technology at Arizona State University (4.0 GPA).\n" +
          "Experienced with AWS, Terraform, Docker, and CI/CD automation.";
      }

      if (file === "experience.log") {
        return "[2023-2024] Associate Data Scientist \u2014 Deep Algorithms & Solutions\n" +
          "            45% deployment efficiency | 99.9% uptime | AWS + Terraform + Docker\n\n" +
          "[2023]      Software Dev Intern \u2014 Backflipt Xenovous\n" +
          "            Java/Spring Boot backend | React Native | Redux\n\n" +
          "[2021-2022] Data Science Intern \u2014 Deep Algorithms & Solutions\n" +
          "            15+ AWS services explored | 30% automation gains | Python + Flask";
      }

      if (file === "certs.yaml") {
        return "certifications:\n" +
          "  - name: AWS Cloud Security Foundations\n" +
          "    issuer: Amazon Web Services\n" +
          "    date: Oct 2025\n\n" +
          "  - name: AWS Cloud Operations\n" +
          "    issuer: Amazon Web Services\n" +
          "    date: Oct 2025\n\n" +
          "  - name: AWS Cloud Architecting\n" +
          "    issuer: Amazon Web Services\n" +
          "    date: Apr 2025\n\n" +
          "  - name: AWS Cloud Practitioner (Cloud Quest)\n" +
          "    issuer: Amazon Web Services\n" +
          "    date: Dec 2024";
      }

      return `cat: ${file}: No such file or directory`;
    },

    clear: () => {
      setTimeout(() => setTerminalText([]), 10);
      return "";
    },

    skill: (args) => {
      if (!args) return "Usage: skill [name]\nAvailable: " + SKILL_NAMES.join(", ");
      const skill = args.trim().toLowerCase();

      const skills: Record<string, string> = {
        aws: "AWS  \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588 5/5\nEC2, S3, Lambda, ECS, VPC, CloudWatch, CodePipeline, CloudTrail, IAM",
        terraform: "Terraform  \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588 5/5\nMulti-resource IaC: Lambda, S3, CloudFront, API Gateway, VPC provisioning",
        docker: "Docker  \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588 5/5\nMulti-stage builds, ECS Fargate deployments, Nginx reverse proxy containers",
        python: "Python  \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2591\u2591\u2591\u2591 4/5\nFlask REST APIs, automation scripts, AWS SDK (boto3), data pipelines",
        cloudformation: "CloudFormation  \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2591\u2591\u2591\u2591 4/5\n3-tier VPC stacks, ECS services, cross-account pipeline orchestration",
        cicd: "CI/CD  \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2591\u2591\u2591\u2591 4/5\nCodePipeline, GitHub Actions, CodeBuild, zero-touch deployments",
        flask: "Flask  \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2591\u2591\u2591\u2591 4/5\nREST APIs, Lambda deployment via Mangum, JWT auth, MongoDB integration",
        linux: "Linux  \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2591\u2591\u2591\u2591 4/5\nBash scripting, system administration, log parsing, cron automation",
      };

      return skills[skill] || `Skill '${args}' not found. Try: ${SKILL_NAMES.join(", ")}`;
    },

    explore: () => {
      localStorage.setItem(PORTFOLIO_VISITED_KEY, 'true');
      setTimeout(() => navigate('/home'), 1000);
      return "Navigating to portfolio...";
    },

    about: () => {
      return "Cloud & DevOps Engineer | MS in IT @ Arizona State University (4.0 GPA)\n\n" +
        "Building production AWS infrastructure with Terraform, Docker, and CI/CD\n" +
        "pipelines. 4 AWS certifications. 5+ deployed projects.\n\n" +
        "Type 'explore' to see the full portfolio.";
    },

    date: () => {
      return new Date().toString();
    },

    neofetch: () => {
      return "        _____          visitor@portfolio\n" +
        "       /     \\         -----------------\n" +
        "      | () () |        OS: Portfolio Linux x86_64\n" +
        "       \\  ^  /         Host: AWS Cloud (us-west-2)\n" +
        "        |||||          Kernel: DevOps 5.15.0\n" +
        "        |||||          Uptime: 99.9%\n" +
        "                       Shell: portfolio-bash\n" +
        "  Cloud & DevOps       Infra: Terraform + Docker\n" +
        "    Engineer           CI/CD: GitHub Actions\n" +
        "                       Stack: React + Flask + AWS";
    },

    uptime: () => {
      const deployed = new Date('2024-12-01');
      const now = new Date();
      const days = Math.floor((now.getTime() - deployed.getTime()) / (1000 * 60 * 60 * 24));
      return ` ${now.toLocaleTimeString()} up ${days} days\n` +
        " Portfolio deployed: December 2024\n" +
        " Status: \u25cf Running (99.9% uptime)\n" +
        " Infra:  Terraform-managed | GitHub Actions CI/CD";
    },

    docker: (args) => {
      if (args?.trim() === 'ps') {
        return "CONTAINER ID   IMAGE                    STATUS    PORTS      NAMES\n" +
          "a1b2c3d4e5f6   aerosec:latest           Up 2mo    443/tcp    aerosec-platform\n" +
          "f6e5d4c3b2a1   microservices-cicd:1.0   Up 9mo    80/tcp     aws-microservices\n" +
          "b2c3d4e5f6a1   cross-account:1.0        Up 9mo    80/tcp     multi-tenant-cicd\n" +
          "c3d4e5f6a1b2   portfolio:latest          Up 14mo   443/tcp    cloud-portfolio\n" +
          "d4e5f6a1b2c3   slate:0.9-beta           Up 13mo   3000/tcp   slate-environments";
      }
      return `docker: '${args || ''}' is not a docker command.\nTry: docker ps`;
    },

    terraform: (args) => {
      if (args?.trim() === 'plan') {
        return "aws_lambda_function.api: Refreshing state...\n" +
          "aws_s3_bucket.frontend: Refreshing state...\n" +
          "aws_cloudfront_distribution.cdn: Refreshing state...\n\n" +
          "No changes. Your infrastructure matches the configuration.\n\n" +
          "  \u2713 12 resources managed (Lambda, S3, CloudFront, API GW, Route53...)\n" +
          "  \u2713 0 to add, 0 to change, 0 to destroy\n" +
          "  \u2713 State: s3://portfolio-terraform-state";
      }
      return `Usage: terraform plan`;
    }
  };

  // Show welcome message on mount
  const showWelcomeMessage = () => {
    const welcomeText =
      "Welcome to Harshith's DevOps Portfolio Terminal!\n" +
      "Type 'help' to see available commands.\n" +
      "Click anywhere on the terminal to start typing.";

    setTerminalText([welcomeText]);
  };

  useEffect(() => {
    showWelcomeMessage();
    const t = setTimeout(() => {
      if (inputRef.current) inputRef.current.focus();
    }, 100);
    return () => clearTimeout(t);
  }, []);

  // Scroll terminal to bottom
  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      if (terminalRef.current) {
        terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
      }
    }, 10);
  }, []);

  // Execute command
  const executeCommand = (fullCommand: string) => {
    const trimmed = fullCommand.trim();
    const parts = trimmed.split(' ');
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1).join(' ');

    // Save to history (only non-empty commands)
    if (trimmed) {
      setCommandHistory(prev => [...prev, trimmed]);
    }
    setHistoryIndex(-1);

    // Show the prompt + command in terminal
    const promptText = `visitor@portfolio:~$ ${fullCommand}`;
    setTerminalText(prev => [...prev, promptText]);

    // Process command
    if (!cmd) {
      // Empty enter — just show a new prompt line (like a real terminal)
      scrollToBottom();
      return;
    }

    if (cmd in availableCommands) {
      const output = availableCommands[cmd](args);
      if (output) {
        setTerminalText(prev => [...prev, output]);
      }
    } else {
      setTerminalText(prev => [
        ...prev,
        `bash: ${cmd}: command not found. Type 'help' for available commands.`
      ]);
    }

    scrollToBottom();
  };

  // Tab completion logic
  const handleTabCompletion = () => {
    const input = userInput;
    const parts = input.split(' ');

    let candidates: string[] = [];
    let prefix = '';

    if (parts.length <= 1) {
      // Completing a command name
      prefix = parts[0].toLowerCase();
      candidates = COMMAND_NAMES.filter(c => c.startsWith(prefix));
    } else {
      // Completing an argument
      const cmd = parts[0].toLowerCase();
      const argPrefix = parts.slice(1).join(' ').toLowerCase();

      if (cmd === 'cat') {
        candidates = FILE_NAMES.filter(f => f.startsWith(argPrefix));
      } else if (cmd === 'skill') {
        candidates = SKILL_NAMES.filter(s => s.startsWith(argPrefix));
      }
      prefix = argPrefix;
    }

    if (candidates.length === 0) return;

    if (candidates.length === 1) {
      // Single match — auto-complete it
      if (parts.length <= 1) {
        setUserInput(candidates[0] + ' ');
      } else {
        setUserInput(parts[0] + ' ' + candidates[0]);
      }
      setTabCycleIndex(-1);
      setTabBase('');
    } else {
      // Multiple matches — cycle through them on repeated Tab presses
      const base = tabBase || input;
      const nextIndex = (tabCycleIndex + 1) % candidates.length;
      setTabCycleIndex(nextIndex);
      setTabBase(base);

      if (parts.length <= 1) {
        setUserInput(candidates[nextIndex]);
      } else {
        setUserInput(parts[0] + ' ' + candidates[nextIndex]);
      }

      // Show all options in terminal on first Tab
      if (tabCycleIndex === -1) {
        setTerminalText(prev => [...prev, candidates.join('  ')]);
        scrollToBottom();
      }
    }
  };

  // Handle Enter key press
  const handleEnterKey = () => {
    executeCommand(userInput);
    setUserInput('');
    // Reset tab state
    setTabCycleIndex(-1);
    setTabBase('');
  };

  // Handle keyboard events
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // Reset tab cycle on any key that's not Tab
    if (e.key !== 'Tab') {
      setTabCycleIndex(-1);
      setTabBase('');
    }

    if (e.key === 'Enter') {
      handleEnterKey();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      handleTabCompletion();
    } else if (e.key === 'l' && e.ctrlKey) {
      // Ctrl+L — clear terminal
      e.preventDefault();
      setTerminalText([]);
    } else if (e.key === 'c' && e.ctrlKey) {
      // Ctrl+C — cancel current input, show ^C
      e.preventDefault();
      const promptText = `visitor@portfolio:~$ ${userInput}^C`;
      setTerminalText(prev => [...prev, promptText]);
      setUserInput('');
      setHistoryIndex(-1);
      scrollToBottom();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length > 0) {
        const newIndex = historyIndex < commandHistory.length - 1 ? historyIndex + 1 : historyIndex;
        setHistoryIndex(newIndex);
        setUserInput(commandHistory[commandHistory.length - 1 - newIndex] || '');
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setUserInput(commandHistory[commandHistory.length - 1 - newIndex] || '');
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setUserInput('');
      }
    }
  };

  return (
    <div className="min-h-screen relative bg-gradient-to-br from-background via-secondary to-background dark:from-black dark:via-pink-950/30 dark:to-black flex items-center justify-center p-4 overflow-hidden">
      {/* Theme Toggle - Fixed top right */}
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle />
      </div>

      {/* Gradient orbs for visual depth */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 dark:bg-primary/20 rounded-full blur-3xl animate-gradient-glow"></div>
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-accent/10 dark:bg-accent/20 rounded-full blur-3xl animate-gradient-glow animation-delay-300"></div>


      {/* Floating Tech Icons Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[FaAws, FaDocker, FaLinux, FaPython, FaGitAlt, SiKubernetes, SiTerraform, SiAnsible,
          FaJenkins, SiGrafana, SiPrometheus, FaReact, SiApachekafka, SiNginx, SiRedis].map((Icon, index) => {
            const iconColors = [
              "text-primary/20",
              "text-primary/15",
              "text-accent/20",
              "text-accent/15",
              "text-primary/25"
            ];
            const randomColor = iconColors[Math.floor(Math.random() * iconColors.length)];

            return (
              <motion.div
                key={index}
                className={`absolute ${randomColor}`}
                initial={{
                  x: Math.random() * window.innerWidth,
                  y: Math.random() * window.innerHeight,
                  scale: 0.5 + Math.random() * 1.5,
                  opacity: 0.3 + Math.random() * 0.4
                }}
                animate={{
                  x: [null, Math.random() * window.innerWidth, Math.random() * window.innerWidth],
                  y: [null, Math.random() * window.innerHeight, Math.random() * window.innerHeight],
                  rotate: [0, Math.random() * 360],
                  scale: [null, 0.8 + Math.random() * 1.7, 0.6 + Math.random() * 1.2]
                }}
                transition={{
                  duration: 20 + Math.random() * 30,
                  ease: "linear",
                  repeat: Infinity,
                  delay: Math.random() * 5
                }}
                style={{ fontSize: `${2 + Math.random() * 4}rem` }}
              >
                <Icon />
              </motion.div>
            );
          })}
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-screen-xl relative z-10"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          {/* Left: Terminal and heading */}
          <div className="text-center md:text-left">
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
              Harshith Siddardha Manne
            </h1>
            <h2 className="text-xl md:text-2xl text-muted-foreground mb-6">
              Cloud & DevOps Engineer
            </h2>

            {/* Terminal window with overlay effects */}
            <div className="relative mx-auto md:ml-0 md:mr-auto max-w-md">
              <div className="absolute -inset-1 bg-gradient-to-r from-primary to-accent rounded-lg blur opacity-50 animate-gradient-glow"></div>
              <div className="relative glass-card p-4 rounded-lg">
                {/* Terminal UI */}
                <div className="bg-gray-900 dark:bg-gray-950 rounded-md overflow-hidden border border-border">
                  {/* Title bar */}
                  <div className="bg-gray-800 dark:bg-gray-900 p-2 border-b border-gray-700">
                    <div className="flex space-x-2">
                      <div className="w-3 h-3 rounded-full bg-red-500"></div>
                      <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                      <div className="ml-2 text-xs text-gray-400 flex items-center">
                        <FaTerminal className="mr-2" /> portfolio-terminal
                      </div>
                    </div>
                  </div>

                  {/* Terminal body — clicking ANYWHERE here focuses the input */}
                  <div
                    ref={terminalRef}
                    onClick={focusTerminal}
                    className="font-mono text-xs md:text-sm text-green-400 text-left p-4 h-80 overflow-auto bg-gradient-to-br from-gray-900 to-black cursor-text select-text"
                  >
                    {terminalText.map((text, index) => (
                      <div key={index} className="whitespace-pre-wrap mb-2">{text}</div>
                    ))}
                    <div className="flex items-center">
                      <span className="text-primary shrink-0">visitor@portfolio:~$&nbsp;</span>
                      <input
                        ref={inputRef}
                        type="text"
                        value={userInput}
                        onChange={(e) => setUserInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="flex-1 bg-transparent border-none outline-none text-green-400 caret-green-400 min-w-0"
                        spellCheck="false"
                        autoComplete="off"
                        autoCapitalize="off"
                        autoCorrect="off"
                        autoFocus
                      />
                      <span className="ml-0.5 w-2 h-5 bg-green-400 animate-pulse shrink-0"></span>
                    </div>
                  </div>
                </div>

                {/* Hint section below the terminal */}
                <div className="mt-4 font-mono text-xs md:text-sm text-left p-3 rounded-md bg-secondary/50 dark:bg-black/70 border border-border">
                  <div className="text-primary mb-2">// Quick start:</div>
                  <div className="text-muted-foreground">Type <span className="text-amber-500 dark:text-amber-300">'help'</span> to see all commands</div>
                  <div className="text-muted-foreground">Try <span className="text-amber-500 dark:text-amber-300">'docker ps'</span> or <span className="text-amber-500 dark:text-amber-300">'terraform plan'</span></div>
                  <div className="text-muted-foreground">Run <span className="text-amber-500 dark:text-amber-300">'cat skills.txt'</span> or <span className="text-amber-500 dark:text-amber-300">'neofetch'</span></div>
                  <div className="text-muted-foreground">Use <span className="text-amber-500 dark:text-amber-300">'explore'</span> to continue to portfolio</div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Welcome form */}
          <div>
            <WelcomeForm />
          </div>
        </div>
      </motion.div>
    </div>
  );
}
