import { useState, useEffect, useRef, KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import WelcomeForm from '@/components/WelcomeForm';
import { motion } from 'framer-motion';
import { FaAws, FaDocker, FaLinux, FaPython, FaGitAlt, FaJenkins, FaTerminal, FaReact, FaHeart } from 'react-icons/fa';
import { SiKubernetes, SiTerraform, SiAnsible, SiGrafana, SiPrometheus, SiApachekafka, SiNginx, SiRedis } from 'react-icons/si';
import { useVisitorTracking } from '@/hooks/useVisitorTracking';
import { ThemeToggle } from '@/components/theme-toggle';

const PORTFOLIO_VISITED_KEY = 'portfolio_visited';

export default function Welcome() {
  const [terminalText, setTerminalText] = useState<string[]>([]);
  const [userInput, setUserInput] = useState('');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
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


  // Available commands and their outputs
  const availableCommands: Record<string, (args?: string) => string> = {
    help: () =>
      "Available commands:\n" +
      "  help           - Show this help message\n" +
      "  whoami         - Display current user\n" +
      "  ls             - List directory contents\n" +
      "  cat [file]     - Display file contents\n" +
      "  clear          - Clear the terminal\n" +
      "  skill [name]   - Display skill details\n" +
      "  explore        - Continue to portfolio\n" +
      "  about          - About Harshith",

    whoami: () => "prospective-employer",

    ls: () =>
      "skills.txt    projects.json    about.md    experience.log",

    cat: (args) => {
      if (!args) return "Usage: cat [file]";
      const file = args.trim();

      if (file === "skills.txt") {
        return "• Cloud Infrastructure (AWS, Azure, GCP)\n" +
          "• Infrastructure as Code (Terraform, CloudFormation)\n" +
          "• Containerization (Docker, Kubernetes)\n" +
          "• CI/CD (Jenkins, GitHub Actions)\n" +
          "• Scripting (Python, Bash)\n" +
          "• Monitoring & Observability (Prometheus, Grafana)";
      }

      if (file === "projects.json") {
        return '{\n' +
          '  "projects": [\n' +
          '    {\n' +
          '      "name": "Auto-scaling Microservice Platform",\n' +
          '      "tech": ["Kubernetes", "Terraform", "AWS", "Prometheus"]\n' +
          '    },\n' +
          '    {\n' +
          '      "name": "CI/CD Pipeline Automation",\n' +
          '      "tech": ["Jenkins", "Docker", "GitLab", "Ansible"]\n' +
          '    },\n' +
          '    {\n' +
          '      "name": "Cloud Cost Optimization Tool",\n' +
          '      "tech": ["Python", "AWS SDK", "Lambda", "DynamoDB"]\n' +
          '    }\n' +
          '  ]\n' +
          '}';
      }

      if (file === "about.md") {
        return "# Harshith Siddardha Manne\n\n" +
          "Cloud & DevOps Engineer passionate about building resilient, scalable\n" +
          "infrastructure and optimizing development workflows.\n\n" +
          "With extensive experience in AWS, Kubernetes, and automation tools,\n" +
          "I help organizations implement robust DevOps practices and cloud-native solutions.";
      }

      if (file === "experience.log") {
        return "2023-Present: Senior DevOps Engineer at CloudScale Solutions\n" +
          "2020-2023: Cloud Infrastructure Engineer at TechInnovate\n" +
          "2018-2020: Systems Administrator at DataCorp";
      }

      return `cat: ${file}: No such file or directory`;
    },

    clear: () => {
      setTimeout(() => setTerminalText([]), 10);
      return "";
    },

    skill: (args) => {
      if (!args) return "Usage: skill [name]";
      const skill = args.trim().toLowerCase();

      const skills: Record<string, string> = {
        aws: "AWS: ⭐⭐⭐⭐⭐\nExpert in EC2, S3, Lambda, ECS, EKS, CloudFormation, and AWS architecture design.",
        kubernetes: "Kubernetes: ⭐⭐⭐⭐\nExperienced in cluster management, deployment strategies, and Helm.",
        terraform: "Terraform: ⭐⭐⭐⭐⭐\nInfrastructure as Code specialist with multi-cloud deployment expertise.",
        docker: "Docker: ⭐⭐⭐⭐⭐\nContainer expert with experience in multi-stage builds and optimization.",
        jenkins: "Jenkins: ⭐⭐⭐⭐\nCI/CD pipeline architecture and implementation specialist.",
        python: "Python: ⭐⭐⭐⭐\nAutomation scripting, AWS SDK, and infrastructure tooling.",
        ansible: "Ansible: ⭐⭐⭐⭐\nConfiguration management and infrastructure automation.",
        prometheus: "Prometheus: ⭐⭐⭐\nMetrics collection, alerting, and monitoring solutions.",
      };

      return skills[skill] || `Skill '${args}' not found. Try: aws, kubernetes, terraform, docker, jenkins, python, ansible, prometheus`;
    },

    explore: () => {
      localStorage.setItem(PORTFOLIO_VISITED_KEY, 'true');
      setTimeout(() => navigate('/home'), 1000);
      return "Navigating to portfolio...";
    },

    about: () => {
      return "Harshith Siddardha Manne is a Cloud & DevOps Engineer with expertise in\n" +
        "building and maintaining scalable, reliable infrastructure.\n\n" +
        "With a passion for automation and continuous improvement,\n" +
        "Harshith specializes in cloud architecture, containerization,\n" +
        "and creating efficient CI/CD pipelines.\n\n" +
        "Type 'explore' to learn more about Harshith's work.";
    }
  };

  // Show welcome message and focus input on mount
  const showWelcomeMessage = () => {
    const welcomeText =
      "Welcome to Harshith's DevOps Portfolio Terminal!\n" +
      "Type 'help' to see available commands.";

    setTerminalText([welcomeText]);
  };

  useEffect(() => {
    showWelcomeMessage();
    const t = setTimeout(() => {
      if (inputRef.current) inputRef.current.focus();
    }, 100);
    return () => clearTimeout(t);
  }, []);

  // Execute command
  const executeCommand = (fullCommand: string) => {
    const parts = fullCommand.trim().split(' ');
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1).join(' ');

    // Save command to history
    setCommandHistory(prev => [...prev, fullCommand]);
    setHistoryIndex(-1);

    // Show command in terminal
    const promptText = `visitor@portfolio:~$ ${fullCommand}`;
    setTerminalText(prev => [...prev, promptText]);

    // Process command
    if (cmd && cmd in availableCommands) {
      const output = availableCommands[cmd](args);
      if (output) {
        setTerminalText(prev => [...prev, output]);
      }
    } else if (cmd) {
      setTerminalText(prev => [...prev, `Command not found: ${cmd}. Type 'help' for available commands.`]);
    }

    // Scroll to bottom
    setTimeout(() => {
      if (terminalRef.current) {
        terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
      }
    }, 10);
  };

  // Handle Enter key press
  const handleEnterKey = () => {
    if (userInput.trim()) {
      executeCommand(userInput);
      setUserInput('');
    }
  };

  // Handle keyboard navigation in command history
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleEnterKey();
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

                  <div
                    ref={terminalRef}
                    className="font-mono text-xs md:text-sm text-green-400 text-left p-4 h-80 overflow-auto bg-gradient-to-br from-gray-900 to-black"
                  >
                    {terminalText.map((text, index) => (
                      <div key={index} className="whitespace-pre-wrap mb-2">{text}</div>
                    ))}
                    <div className="flex items-center">
                      <span className="text-primary">visitor@portfolio:~$&nbsp;</span>
                      <input
                        ref={inputRef}
                        type="text"
                        value={userInput}
                        onChange={(e) => setUserInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="flex-1 bg-transparent border-none outline-none text-green-400"
                        spellCheck="false"
                        autoComplete="off"
                        autoFocus
                      />
                      <span className="ml-1 w-2 h-5 bg-green-400 animate-pulse"></span>
                    </div>
                  </div>
                </div>

                {/* Hint section below the terminal */}
                <div className="mt-4 font-mono text-xs md:text-sm text-left p-3 rounded-md bg-secondary/50 dark:bg-black/70 border border-border">
                  <div className="text-primary mb-2">// Terminal hints:</div>
                  <div className="text-muted-foreground">Type <span className="text-amber-500 dark:text-amber-300">'help'</span> to see all commands</div>
                  <div className="text-muted-foreground">Try <span className="text-amber-500 dark:text-amber-300">'cat about.md'</span> or <span className="text-amber-500 dark:text-amber-300">'skill aws'</span></div>
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