import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Server, Container, Rocket, BarChart3, Cloud, GitBranch, Layers } from 'lucide-react';

const capabilities = [
  {
    title: 'Infrastructure',
    icon: Server,
    items: [
      'Terraform for Infrastructure as Code',
      'AWS services: EC2, S3, IAM, Lambda, API Gateway where applicable',
      'Multi-cloud integration (AWS, Azure, GCP) for project needs',
    ],
  },
  {
    title: 'Containerization',
    icon: Container,
    items: [
      'Docker for building and running containerized applications',
      'Container workflow: build, tag, push, deploy',
      'Use of Docker Compose for local development where needed',
    ],
  },
  {
    title: 'Deployment',
    icon: Rocket,
    items: [
      'CI/CD via GitHub Actions where implemented',
      'Manual deployment flow for projects where that is the current approach',
      'Pipeline triggers and deployment automation where in use',
    ],
  },
  {
    title: 'Observability & Reliability',
    icon: BarChart3,
    items: [
      'Structured logging strategy for applications',
      'Monitoring approach (e.g., CloudWatch, application metrics)',
      'Alerting and health checks where configured',
    ],
  },
];

export default function CloudDevOpsCapabilities() {
  return (
    <section id="cloud-devops" className="pb-20 md:pb-24 section-light relative overflow-hidden">
      <div className="absolute inset-0 z-0">
        <div className="absolute top-1/4 right-0 w-40 md:w-80 h-40 md:h-80 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-0 w-48 md:w-96 h-48 md:h-96 bg-accent/5 rounded-full blur-3xl" />
      </div>

      <div className="container px-4 md:px-6 relative z-10">
        <div className="text-center mb-10 md:mb-16">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <Badge variant="outline" className="mb-3 md:mb-4 border-primary/40 text-primary px-3 md:px-4 py-1 text-xs md:text-sm">
              <Cloud className="h-3 w-3 md:h-3.5 md:w-3.5 mr-1.5 md:mr-2" />
              Production-Ready Systems
            </Badge>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 md:mb-6 text-foreground">
              How I Build Production-Ready Systems
            </h2>
            <p className="text-sm md:text-base text-muted-foreground max-w-2xl mx-auto">
              Infrastructure as Code, containerization, deployment automation, and observability applied across my projects.
            </p>
            <div className="w-16 md:w-24 h-1 bg-gradient-to-r from-primary via-accent to-primary mx-auto rounded-full mt-4" />
          </motion.div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
          {capabilities.map((cap, index) => {
            const Icon = cap.icon;
            return (
              <motion.div
                key={cap.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1, duration: 0.5 }}
              >
                <Card className="p-6 border border-border/50 bg-card/80 h-full">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2.5 rounded-xl bg-primary/10">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="text-lg font-bold text-foreground">{cap.title}</h3>
                  </div>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {cap.items.map((item, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-primary mt-1.5 shrink-0">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
