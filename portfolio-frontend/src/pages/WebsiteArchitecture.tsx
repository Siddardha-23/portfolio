import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Globe, Lock, Code, Container, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function WebsiteArchitecture() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="container flex items-center justify-between py-3">
          <Button variant="ghost" onClick={() => navigate('/home')} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Portfolio
          </Button>
        </div>
      </header>

      <main className="container px-4 md:px-6 py-10 md:py-16 max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Badge variant="outline" className="mb-4 border-primary/40 text-primary">How This Site Is Built</Badge>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            How This Website Is Architected
          </h1>
          <p className="text-muted-foreground mb-8 leading-relaxed">
            This page describes the hosting, deployment, and infrastructure of this portfolio site. All claims are accurate; where something is not yet implemented, it is listed under Planned Improvements.
          </p>

          <div className="space-y-6">
            <Card className="p-5 border border-border/50">
              <div className="flex items-center gap-2 mb-3">
                <Globe className="h-5 w-5 text-primary" />
                <h2 className="font-bold text-foreground">Hosting</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                The site is a React SPA. Hosting may be static (e.g., S3 + CloudFront) or a similar platform. Backend APIs, when used, may run on serverless or containerized infrastructure.
              </p>
            </Card>

            <Card className="p-5 border border-border/50">
              <div className="flex items-center gap-2 mb-3">
                <Code className="h-5 w-5 text-primary" />
                <h2 className="font-bold text-foreground">Deployment</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                Deployment is done via build pipelines (e.g., GitHub Actions or AWS CodePipeline). Manual deployment may be used for some environments. The exact CI/CD setup depends on the current repository and hosting choice.
              </p>
            </Card>

            <Card className="p-5 border border-border/50">
              <div className="flex items-center gap-2 mb-3">
                <Container className="h-5 w-5 text-primary" />
                <h2 className="font-bold text-foreground">Docker</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                The application can be containerized with Docker for consistent builds. Whether the live site is served from containers (e.g., ECS) or static hosting depends on the current architecture.
              </p>
            </Card>

            <Card className="p-5 border border-border/50">
              <div className="flex items-center gap-2 mb-3">
                <Lock className="h-5 w-5 text-primary" />
                <h2 className="font-bold text-foreground">SSL / HTTPS</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                HTTPS is used where the hosting platform provides it (e.g., ACM for AWS, or platform-managed certificates). Custom domain and certificate setup depend on the current deployment.
              </p>
            </Card>

            <Card className="p-5 border border-border/50 bg-primary/5 border-primary/20">
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle className="h-5 w-5 text-primary" />
                <h2 className="font-bold text-foreground">Planned Improvements</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                Future improvements may include: full Terraform-managed infra, ALB in front of compute, automated CI/CD from main branch, Docker-based deploy, and monitoring/alerting. This section will be updated as each is implemented.
              </p>
            </Card>
          </div>

          <div className="mt-10">
            <Button asChild variant="outline" className="border-primary/50 text-primary hover:bg-primary/10">
              <Link to="/home">Back to Home</Link>
            </Button>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
