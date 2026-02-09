import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Mail, Phone, Send, Github, Linkedin,
  CheckCircle2, ArrowRight, ExternalLink, MapPin,
  MessageSquare, Clock, Sparkles, Heart
} from 'lucide-react';
import { PERSONAL_INFO } from '@/lib/constants';
import { toast } from 'sonner';
import { apiService } from '@/lib/api';

type FormErrors = {
  name?: string;
  email?: string;
  subject?: string;
  message?: string;
};

// Quick connect button component
function QuickConnectButton({ icon: Icon, label, href, color, isExternal }: {
  icon: React.ElementType;
  label: string;
  href: string;
  color: string;
  isExternal?: boolean;
}) {
  return (
    <motion.a
      href={href}
      target={isExternal ? "_blank" : undefined}
      rel={isExternal ? "noopener noreferrer" : undefined}
      whileHover={{ scale: 1.05, y: -3 }}
      whileTap={{ scale: 0.98 }}
      className="group flex flex-col items-center p-3 md:p-4 rounded-xl md:rounded-2xl bg-card border border-border/50 hover:border-primary/30 transition-all duration-300 shadow-lg hover:shadow-xl"
    >
      <div
        className="w-10 h-10 md:w-14 md:h-14 rounded-lg md:rounded-xl flex items-center justify-center mb-2 md:mb-3 transition-transform duration-300 group-hover:scale-110"
        style={{ background: `${color}20` }}
      >
        <Icon className="h-5 w-5 md:h-6 md:w-6" style={{ color }} />
      </div>
      <span className="text-xs md:text-sm font-medium text-foreground">{label}</span>
      <span className="text-[10px] md:text-xs text-muted-foreground mt-0.5 md:mt-1 flex items-center">
        {isExternal ? 'Open' : 'Contact'}
        <ExternalLink className="h-2.5 w-2.5 md:h-3 md:w-3 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
      </span>
    </motion.a>
  );
}

// Animated input with floating label
function AnimatedInput({
  id,
  label,
  error,
  type = 'text',
  ...props
}: {
  id: string;
  label: string;
  error?: string;
  type?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  const [isFocused, setIsFocused] = useState(false);
  const hasValue = props.value && String(props.value).length > 0;

  return (
    <div className="relative">
      <Input
        {...props}
        id={id}
        type={type}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        className={`pt-5 pb-2 h-14 bg-secondary/30 border-border/50 focus:border-primary transition-all ${error ? 'border-red-500' : ''}`}
      />
      <Label
        htmlFor={id}
        className={`absolute left-3 transition-all duration-200 pointer-events-none ${isFocused || hasValue
          ? 'top-2 text-xs text-primary'
          : 'top-1/2 -translate-y-1/2 text-muted-foreground'
          }`}
      >
        {label}
      </Label>
      <AnimatePresence>
        {error && (
          <motion.span
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="absolute -bottom-5 left-0 text-xs text-red-500"
          >
            {error}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Contact() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [messageLength, setMessageLength] = useState(0);

  useEffect(() => {
    setMessageLength(formData.message.length);
  }, [formData.message]);

  const validateForm = () => {
    const errors: FormErrors = {};
    let isValid = true;

    if (formData.name.trim().length < 2) {
      errors.name = 'Name must be at least 2 characters';
      isValid = false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      errors.email = 'Please enter a valid email address';
      isValid = false;
    }

    if (formData.subject.trim().length < 3) {
      errors.subject = 'Subject must be at least 3 characters';
      isValid = false;
    }

    if (formData.message.trim().length < 10) {
      errors.message = 'Message must be at least 10 characters';
      isValid = false;
    }

    setFormErrors(errors);
    return isValid;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear error when user starts typing
    if (formErrors[name as keyof FormErrors]) {
      setFormErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error("Please fix the errors in your form");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await apiService.submitContact(
        formData.name,
        formData.email,
        formData.subject,
        formData.message
      );

      if (response.error) {
        toast.error("Failed to send message", { description: response.error });
        setIsSubmitting(false);
        return;
      }

      toast.success("Message sent successfully!");
      setFormSubmitted(true);

      setTimeout(() => {
        setFormData({ name: '', email: '', subject: '', message: '' });
        setIsSubmitting(false);
        setFormSubmitted(false);
      }, 3000);
    } catch (error) {
      toast.error("An unexpected error occurred");
      setIsSubmitting(false);
    }
  };

  const quickConnectOptions = [
    { icon: Mail, label: 'Email', href: `mailto:${PERSONAL_INFO.email}`, color: '#ea4335' },
    { icon: Phone, label: 'Call', href: `tel:${PERSONAL_INFO.phone}`, color: '#10b981' },
    { icon: Linkedin, label: 'LinkedIn', href: `https://${PERSONAL_INFO.linkedin}`, color: '#0a66c2', isExternal: true },
    { icon: Github, label: 'GitHub', href: `https://${PERSONAL_INFO.github}`, color: '#333', isExternal: true }
  ];

  return (
    <section id="contact" className="relative pb-20 md:pb-24 section-dark overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-0 right-0 w-48 md:w-96 h-48 md:h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-40 md:w-80 h-40 md:h-80 bg-accent/5 rounded-full blur-3xl" />

        {/* Decorative shapes - hidden on mobile */}
        <motion.div
          className="absolute top-20 left-20 w-4 h-4 rounded-full bg-primary/30 hidden md:block"
          animate={{ y: [0, 20, 0], opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 4, repeat: Infinity }}
        />
        <motion.div
          className="absolute bottom-32 right-32 w-6 h-6 rounded-full bg-accent/30 hidden md:block"
          animate={{ y: [0, -20, 0], opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 5, repeat: Infinity, delay: 1 }}
        />
      </div>

      <div className="container px-4 md:px-6 relative z-10">
        {/* Section header */}
        <div className="text-center mb-10 md:mb-16">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <Badge variant="outline" className="mb-3 md:mb-4 border-primary/40 text-primary px-3 md:px-4 py-1 text-xs md:text-sm">
              <MessageSquare className="h-3 w-3 md:h-3.5 md:w-3.5 mr-1.5 md:mr-2" />
              Let's Connect
            </Badge>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 md:mb-6 gradient-text">
              Get In Touch
            </h2>
            <p className="text-sm md:text-base text-muted-foreground max-w-2xl mx-auto mb-4 md:mb-6 px-4">
              Have a project in mind or interested in working together?
              I'd love to hear from you. Let's create something amazing!
            </p>
            <div className="w-16 md:w-24 h-1 bg-gradient-to-r from-primary via-accent to-primary mx-auto rounded-full" />
          </motion.div>
        </div>

        {/* Quick connect buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 max-w-2xl mx-auto mb-10 md:mb-16"
        >
          {quickConnectOptions.map((option, i) => (
            <QuickConnectButton key={i} {...option} />
          ))}
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 max-w-6xl mx-auto">
          {/* Contact info side */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="lg:col-span-2"
          >
            <Card className="h-full border-0 shadow-2xl bg-gradient-to-br from-card to-secondary/20">
              <CardContent className="p-8">
                <h3 className="text-2xl font-bold mb-6 text-foreground flex items-center gap-2">
                  <span className="w-8 h-1 bg-primary rounded-full" />
                  Contact Info
                </h3>

                <div className="space-y-6">
                  {/* Location */}
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <MapPin className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-medium text-foreground">Location</h4>
                      <p className="text-muted-foreground">Tempe, Arizona, USA</p>
                    </div>
                  </div>

                  {/* Response time */}
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                      <Clock className="h-5 w-5 text-emerald-500" />
                    </div>
                    <div>
                      <h4 className="font-medium text-foreground">Response Time</h4>
                      <p className="text-muted-foreground">Usually within 24 hours</p>
                    </div>
                  </div>

                  {/* Availability */}
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                      <Sparkles className="h-5 w-5 text-amber-500" />
                    </div>
                    <div>
                      <h4 className="font-medium text-foreground">Availability</h4>
                      <p className="text-muted-foreground">Open for full-time opportunities</p>
                    </div>
                  </div>
                </div>

                {/* Divider */}
                <div className="my-8 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

                {/* Fun message */}
                <div className="text-center">
                  <p className="text-sm text-muted-foreground flex items-center justify-center gap-2">
                    Made with <Heart className="h-4 w-4 text-red-500 animate-pulse" /> and lots of coffee
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Contact form */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="lg:col-span-3"
          >
            <Card className="border-0 shadow-2xl overflow-hidden">
              <div className="h-1.5 bg-gradient-to-r from-primary via-accent to-primary" />
              <CardContent className="p-8">
                <AnimatePresence mode="wait">
                  {formSubmitted ? (
                    <motion.div
                      key="success"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="flex flex-col items-center justify-center py-16"
                    >
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 200 }}
                        className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mb-6"
                      >
                        <CheckCircle2 className="h-10 w-10 text-emerald-500" />
                      </motion.div>
                      <h3 className="text-2xl font-bold text-foreground mb-2">Message Sent!</h3>
                      <p className="text-muted-foreground text-center max-w-sm">
                        Thanks for reaching out. I'll get back to you as soon as possible.
                      </p>
                    </motion.div>
                  ) : (
                    <motion.form
                      key="form"
                      initial={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onSubmit={handleSubmit}
                      className="space-y-6"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <AnimatedInput
                          id="name"
                          name="name"
                          label="Your Name"
                          value={formData.name}
                          onChange={handleChange}
                          error={formErrors.name}
                        />
                        <AnimatedInput
                          id="email"
                          name="email"
                          type="email"
                          label="Email Address"
                          value={formData.email}
                          onChange={handleChange}
                          error={formErrors.email}
                        />
                      </div>

                      <AnimatedInput
                        id="subject"
                        name="subject"
                        label="Subject"
                        value={formData.subject}
                        onChange={handleChange}
                        error={formErrors.subject}
                      />

                      <div className="relative">
                        <Textarea
                          id="message"
                          name="message"
                          placeholder="Write your message here..."
                          rows={5}
                          value={formData.message}
                          onChange={handleChange}
                          className={`resize-none bg-secondary/30 border-border/50 focus:border-primary ${formErrors.message ? 'border-red-500' : ''}`}
                        />
                        <div className="absolute bottom-3 right-3 text-xs text-muted-foreground">
                          {messageLength}/500
                        </div>
                        <AnimatePresence>
                          {formErrors.message && (
                            <motion.span
                              initial={{ opacity: 0, y: -5 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -5 }}
                              className="absolute -bottom-5 left-0 text-xs text-red-500"
                            >
                              {formErrors.message}
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </div>

                      <Button
                        type="submit"
                        className="w-full btn-premium h-14 text-lg group"
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? (
                          <div className="flex items-center gap-2">
                            <div className="h-5 w-5 rounded-full border-2 border-t-transparent border-white animate-spin" />
                            <span>Sending...</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Send className="h-5 w-5" />
                            <span>Send Message</span>
                            <ArrowRight className="h-5 w-5 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                          </div>
                        )}
                      </Button>

                      <p className="text-xs text-center text-muted-foreground">
                        By sending, you agree to be contacted regarding your message.
                      </p>
                    </motion.form>
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </section>
  );
}