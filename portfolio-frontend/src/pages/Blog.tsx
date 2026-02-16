import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function Blog() {
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
          <Badge variant="outline" className="mb-4 border-primary/40 text-primary">Technical Writing</Badge>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Blog
          </h1>
          <p className="text-muted-foreground mb-8 leading-relaxed">
            Placeholder for future technical articles (e.g., API Gateway, multi-cloud architecture, Terraform state, cost optimization). No articles published yet.
          </p>

          <Card className="p-8 border border-border/50 border-dashed text-center">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="font-semibold text-foreground mb-2">Coming Soon</h2>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Technical blog posts will appear here. Structure is ready for when content is written.
            </p>
          </Card>

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
