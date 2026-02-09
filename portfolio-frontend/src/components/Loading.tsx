import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

export default function Loading({ onComplete }: { onComplete: () => void }) {
  const [progress, setProgress] = useState(0);
  const [text, setText] = useState('');
  const [codeBlocks, setCodeBlocks] = useState<string[]>([]);
  const fullText = "Loading my portfolio...";
  const textSpeed = 80; // milliseconds per character
  const loadingTime = 3000; // total loading time in milliseconds

  const codeSnippets = [
    "<div className='portfolio'>",
    "  <Header />",
    "  <Hero />",
    "  <About />",
    "  <Skills />",
    "  <Projects />",
    "  <Contact />",
    "</div>",
  ];

  useEffect(() => {
  let textTimeout: ReturnType<typeof setTimeout>;
  let codeTimeout: ReturnType<typeof setTimeout>;
  let progressInterval: ReturnType<typeof setInterval>;
  let index = 0;
  let codeIndex = 0;

  // Reset text and code blocks once, synchronously
  setText('');
  setCodeBlocks([]);

  // Typing effect using internal variable
  const typeText = () => {
    if (index < fullText.length) {
      const nextChar = fullText.charAt(index);
      setText((prev) => prev + nextChar);
      index++;
      textTimeout = setTimeout(typeText, textSpeed);
    }
  };

  // Code block appearance
  const showCodeBlocks = () => {
    if (codeIndex < codeSnippets.length) {
      setCodeBlocks((prev) => [...prev, codeSnippets[codeIndex]]);
      codeIndex++;
      codeTimeout = setTimeout(showCodeBlocks, 200);
    }
  };

  // Start both animations after a small delay
  setTimeout(() => {
    typeText();
    showCodeBlocks();
  }, 100); // slight delay to ensure setText('') finishes rendering

  // Progress bar animation
  progressInterval = setInterval(() => {
    setProgress((prevProgress) => {
      const newProgress = prevProgress + 1;
      if (newProgress >= 100) {
        clearInterval(progressInterval);
        setTimeout(() => {
          onComplete();
        }, 500);
        return 100;
      }
      return newProgress;
    });
  }, loadingTime / 100);

  return () => {
    clearTimeout(textTimeout);
    clearTimeout(codeTimeout);
    clearInterval(progressInterval);
  };
}, [onComplete]);


  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-background z-50">
      <div className="flex flex-col items-center space-y-6">
        {/* Code-themed spinner */}
        <div className="relative w-28 h-28">
          <motion.div 
            className="absolute inset-0 border-t-4 border-indigo-500 dark:border-indigo-400 border-solid rounded-md"
            animate={{ rotate: 360 }}
            transition={{ 
              duration: 2,
              repeat: Infinity,
              ease: "linear"
            }}
          />
          <motion.div 
            className="absolute inset-2 border-r-4 border-cyan-500 dark:border-cyan-400 border-solid rounded-md"
            animate={{ rotate: -360 }}
            transition={{ 
              duration: 3,
              repeat: Infinity,
              ease: "linear"
            }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-3xl font-mono font-bold text-primary animate-pulse">{`</>`}</div>
          </div>
        </div>
        
        {/* Code blocks */}
        <div className="bg-muted w-80 h-32 rounded-md p-3 overflow-hidden font-mono text-xs relative">
          <div className="flex flex-col space-y-1 text-muted-foreground">
            {codeBlocks.map((line, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3 }}
                className={line && line.includes("</div>") ? "pl-0" : "pl-4"}
              >
                {line}
              </motion.div>
            ))}
          </div>
        </div>
        
        {/* Typed text */}
        <div className="h-6 text-lg font-medium">{text}</div>
        
        {/* Progress bar */}
        <div className="w-80 bg-muted rounded-full h-2.5 overflow-hidden">
          <motion.div 
            className={cn(
              "h-full rounded-full",
              "bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-400 dark:from-indigo-400 dark:via-purple-400 dark:to-cyan-300"
            )}
            style={{ width: `${progress}%` }}
            initial={{ width: "0%" }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
        <div className="text-sm text-muted-foreground">{progress}%</div>
      </div>
    </div>
  );
}