import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { Button, Card, cn } from '../components/UI';
import { ArrowLeft, Check, Zap, Shield, Globe, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';

export function MembershipPage() {
  const { membership, updateMembership, cancelMembership } = useUser();
  const navigate = useNavigate();

  const plans = [
    { 
      name: 'Starter', 
      price: '$0', 
      features: ['Basic Networking', 'Resource Access', 'Community Feed'],
      icon: Globe
    },
    { 
      name: 'Professional', 
      price: '$29', 
      features: ['Unlimited Connections', 'Advanced Reports', 'Direct Messaging'],
      icon: Zap,
      popular: true
    },
    { 
      name: 'Enterprise', 
      price: '$99', 
      features: ['Team Management', 'Custom Analytics', 'Dedicated Support', 'API Access'],
      icon: Shield
    },
  ];

  return (
    <motion.main 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="max-w-md mx-auto px-6 pt-12 pb-32"
    >
      <header className="flex items-center gap-4 mb-10">
        <button onClick={() => navigate('/profile')} className="text-on-surface active:scale-95 transition-transform">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-2xl font-bold tracking-tight">Membership Plan</h1>
      </header>

      <div className="space-y-8">
        {/* Current Plan Status */}
        <Card className="bg-primary-accent/5 border-primary-accent/20">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-primary-accent mb-1">Current Plan</p>
              <h2 className="text-2xl font-black">{membership.plan}</h2>
            </div>
            <span className={cn(
              "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
              membership.status === 'Active' ? "bg-primary-accent text-on-primary-accent" : "bg-red-400/10 text-red-400"
            )}>
              {membership.status}
            </span>
          </div>
          <div className="flex justify-between text-sm text-on-surface-variant">
            <span>{membership.price}</span>
            <span>Next billing: {membership.nextBilling}</span>
          </div>
        </Card>

        {/* Plan Selection */}
        <div className="space-y-4">
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-on-surface-variant/60">Available Plans</h3>
          {plans.map((plan) => (
            <Card 
              key={plan.name}
              className={cn(
                "relative cursor-pointer transition-all duration-300",
                membership.plan === plan.name ? "border-primary-accent bg-primary-accent/5" : "hover:bg-surface-container"
              )}
              onClick={() => updateMembership(plan.name)}
            >
              {plan.popular && (
                <span className="absolute top-0 right-8 -translate-y-1/2 bg-primary-accent text-on-primary-accent px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg">
                  Popular
                </span>
              )}
              <div className="flex items-center gap-4 mb-4">
                <div className={cn(
                  "w-12 h-12 rounded-full flex items-center justify-center",
                  membership.plan === plan.name ? "bg-primary-accent text-on-primary-accent" : "bg-surface-container-highest text-on-surface"
                )}>
                  <plan.icon className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-lg">{plan.name}</h4>
                  <p className="text-primary-accent font-black">{plan.price}<span className="text-xs font-medium text-on-surface-variant">/mo</span></p>
                </div>
                {membership.plan === plan.name && (
                  <div className="ml-auto w-6 h-6 bg-primary-accent rounded-full flex items-center justify-center">
                    <Check className="w-4 h-4 text-on-primary-accent" />
                  </div>
                )}
              </div>
              <ul className="space-y-2">
                {plan.features.map(feature => (
                  <li key={feature} className="flex items-center gap-2 text-xs text-on-surface-variant">
                    <Check className="w-3 h-3 text-primary-accent" />
                    {feature}
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>

        {membership.status === 'Active' && (
          <button 
            onClick={cancelMembership}
            className="w-full flex items-center justify-center gap-2 text-red-400 text-xs font-bold uppercase tracking-widest py-4 hover:bg-red-400/5 rounded-xl transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Cancel Subscription
          </button>
        )}
      </div>
    </motion.main>
  );
}
