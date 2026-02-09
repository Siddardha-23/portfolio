import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import { Search } from 'lucide-react';
import { ROLES } from '@/lib/constants';

export default function RoleSearch() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  
  // Filter roles based on search query
  const filteredRoles = ROLES.filter(role => 
    role.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const handleRoleSelect = (role: string) => {
    setSelectedRole(role);
    setSearchQuery('');
    
    // Scroll to relevant section based on role
    const scrollToSection = (sectionId: string) => {
      const element = document.getElementById(sectionId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    };
    
    // Map roles to relevant sections
    const roleToSectionMapping: Record<string, string> = {
      'Cloud Engineer': 'skills',
      'DevOps Engineer': 'skills',
      'AWS Specialist': 'skills',
      'Infrastructure Engineer': 'experience',
      'Site Reliability Engineer (SRE)': 'experience',
      'Systems Administrator': 'skills',
      'Backend Developer': 'projects',
      'Full-Stack Developer': 'projects',
      'Data Engineer': 'experience',
    };
    
    const sectionToScrollTo = roleToSectionMapping[role] || 'skills';
    scrollToSection(sectionToScrollTo);
  };
  
  const clearSelectedRole = () => {
    setSelectedRole(null);
  };

  return (
    <div className="bg-card p-6 rounded-xl shadow-md border border-border">
      <h3 className="text-xl font-semibold mb-4 text-foreground">Looking to hire?</h3>
      <p className="text-muted-foreground mb-4">
        Search for a role to quickly see my relevant skills and experience
      </p>
      
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-primary/60 h-4 w-4" />
        <Input
          className="pl-9 border-primary/20 focus-visible:ring-primary/40"
          placeholder="Search roles... (e.g., DevOps Engineer)"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>
      
      {/* Search results */}
      {searchQuery && (
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 border rounded-md max-h-60 overflow-y-auto"
          >
            {filteredRoles.length > 0 ? (
              <ul className="divide-y divide-border">
                {filteredRoles.map((role, index) => (
                  <motion.li
                    key={index}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: index * 0.05 }}
                    className="p-2 hover:bg-secondary/50 cursor-pointer text-sm text-foreground"
                    onClick={() => handleRoleSelect(role)}
                  >
                    {role}
                  </motion.li>
                ))}
              </ul>
            ) : (
              <p className="p-3 text-sm text-muted-foreground">No roles found</p>
            )}
          </motion.div>
        </AnimatePresence>
      )}
      
      {/* Selected role info */}
      {selectedRole && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 p-4 bg-primary/10 rounded-lg border border-primary/20"
        >
          <div className="flex justify-between items-center mb-2">
            <Badge className="bg-accent/20 text-accent hover:bg-accent/30">{selectedRole}</Badge>
            <Button variant="ghost" size="sm" onClick={clearSelectedRole} className="text-primary/70 hover:text-primary hover:bg-primary/10">
              Clear
            </Button>
          </div>
          <p className="text-sm text-foreground/80">
            Scrolled to the most relevant section for this role. Explore my qualifications for {selectedRole}.
          </p>
        </motion.div>
      )}
    </div>
  );
}