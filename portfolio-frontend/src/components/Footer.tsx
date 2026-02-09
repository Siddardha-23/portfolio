import { Link } from 'react-router-dom';
import { Github, Linkedin, Mail, Phone } from 'lucide-react';
import { PERSONAL_INFO } from '@/lib/constants';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-secondary/50 dark:bg-secondary/30 border-t border-border py-12">
      <div className="container px-4 md:px-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Name and Brief */}
          <div>
            <h3 className="text-xl font-bold mb-4 gradient-text">
              Harshith Siddardha Manne
            </h3>
            <p className="text-muted-foreground mb-4">
              Cloud & DevOps Professional with expertise in AWS, Terraform, Docker, and more.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-lg font-semibold mb-4 text-primary">Quick Links</h4>
            <ul className="space-y-2">
              <li>
                <Link to="/home" className="text-muted-foreground hover:text-primary transition-colors">
                  Home
                </Link>
              </li>
              <li>
                <Link to="/home#about" className="text-muted-foreground hover:text-primary transition-colors">
                  About
                </Link>
              </li>
              <li>
                <Link to="/home#skills" className="text-muted-foreground hover:text-primary transition-colors">
                  Skills
                </Link>
              </li>
              <li>
                <Link to="/home#projects" className="text-muted-foreground hover:text-primary transition-colors">
                  Projects
                </Link>
              </li>
              <li>
                <Link to="/home#contact" className="text-muted-foreground hover:text-primary transition-colors">
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h4 className="text-lg font-semibold mb-4 text-primary">Contact</h4>
            <ul className="space-y-3">
              <li className="flex items-center">
                <Mail className="h-5 w-5 mr-2 text-accent" />
                <a
                  href={`mailto:${PERSONAL_INFO.email}`}
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  {PERSONAL_INFO.email}
                </a>
              </li>
              <li className="flex items-center">
                <Phone className="h-5 w-5 mr-2 text-accent" />
                <a
                  href={`tel:${PERSONAL_INFO.phone}`}
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  {PERSONAL_INFO.phone}
                </a>
              </li>
              <li className="flex items-center">
                <Linkedin className="h-5 w-5 mr-2 text-accent" />
                <a
                  href={`https://${PERSONAL_INFO.linkedin}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  LinkedIn
                </a>
              </li>
              <li className="flex items-center">
                <Github className="h-5 w-5 mr-2 text-accent" />
                <a
                  href={`https://${PERSONAL_INFO.github}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  GitHub
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-border mt-8 pt-6 text-center">
          <p className="gradient-text font-medium">
            © {currentYear} Harshith Siddardha Manne. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}