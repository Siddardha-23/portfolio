import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Scale, Shield, DollarSign, Layers, Zap, Server } from 'lucide-react';

const principles = [
  {
    title: 'Scalability',
    icon: Scale,
    description: 'Design for horizontal scaling, stateless services, and queue-based processing where appropriate. Apply auto-scaling and load distribution in cloud deployments.',
  },
  {
    title: 'High Availability',
    icon: Zap,
    description: 'Consider redundancy, health checks, and failover. Use managed services for databases and critical components to reduce single points of failure.',
  },
  {
    title: 'Security',
    icon: Shield,
    description: 'IAM least privilege, secure VPC design, and separation of concerns. Apply secure defaults, secrets management, and minimal exposure of surfaces.',
  },
  {
    title: 'Cost Optimization',
    icon: DollarSign,
    description: 'Right-sizing resources, pay-per-use where possible, and lifecycle policies. Choose services and regions based on cost and latency tradeoffs.',
  },
  {
    title: 'Service Separation',
    icon: Layers,
    description: 'Microservice-minded design: clear boundaries, well-defined interfaces, and independent deployability where it adds value without unnecessary complexity.',
  },
];

export default function SystemDesignThinking() {
  return (
    <section id="system-design" className="pb-20 md:pb-24 section-dark relative overflow-hidden">
      <div className="absolute inset-0 z-0">
        <div className="absolute top-0 left-1/4 w-48 md:w-96 h-48 md:h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-40 md:w-80 h-40 md:h-80 bg-accent/5 rounded-full blur-3xl" />
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
              <Server className="h-3 w-3 md:h-3.5 md:w-3.5 mr-1.5 md:mr-2" />
              Engineering Principles
            </Badge>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 md:mb-6 text-foreground">
              How I Think About System Design
            </h2>
            <p className="text-sm md:text-base text-muted-foreground max-w-2xl mx-auto">
              Applied from coursework and hands-on projects — scalability, availability, security, cost, and clear service boundaries.
            </p>
            <div className="w-16 md:w-24 h-1 bg-gradient-to-r from-primary via-accent to-primary mx-auto rounded-full mt-4" />
          </motion.div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {principles.map((p, index) => {
            const Icon = p.icon;
            return (
              <motion.div
                key={p.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.08, duration: 0.5 }}
              >
                <Card className="p-5 border border-border/50 bg-card/80 h-full">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <h3 className="font-bold text-foreground">{p.title}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{p.description}</p>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
