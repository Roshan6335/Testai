import { motion } from 'motion/react';
import ThreeBackground from './ThreeBackground';
import KeryoLogo from './KeryoLogo';
import { ArrowRight, Sparkles, MessageCircle, Shield, Zap } from 'lucide-react';

export default function LandingPage({ onGetStarted }: { onGetStarted: () => void }) {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <ThreeBackground />
      
      {/* Navigation */}
      <nav className="relative z-10 flex items-center justify-between p-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <KeryoLogo className="w-10 h-10" />
          <span className="text-xl font-semibold tracking-tight text-gray-900">Keryo</span>
        </div>
        <div className="flex items-center gap-6">
          <a href="#features" className="text-sm font-medium text-gray-500 hover:text-black transition-colors">Features</a>
          <button 
            onClick={onGetStarted}
            className="bg-black text-white px-5 py-2 rounded-full text-sm font-medium hover:bg-gray-800 transition-all shadow-lg active:scale-95"
          >
            Get Started
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="relative z-10 pt-20 pb-32 px-6 max-w-7xl mx-auto flex flex-col items-center text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2 bg-gray-100/80 backdrop-blur-sm px-4 py-1.5 rounded-full border border-gray-200 mb-8"
        >
          <Sparkles className="w-4 h-4 text-gray-900" />
          <span className="text-xs font-medium text-gray-600">The minimalist AI companion is here.</span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-6xl md:text-8xl font-medium tracking-tight text-gray-900 mb-8"
        >
          Experience Intelligence,<br />
          <span className="text-gray-400">Refined.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-lg md:text-xl text-gray-500 max-w-2xl mb-12"
        >
          Keryo is built for clarity. A compact, advanced AI interface that fits seamlessly into your workflow. Pure focus, zero distractions.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="flex flex-col sm:flex-row items-center gap-4"
        >
          <button
            onClick={onGetStarted}
            className="group bg-black text-white px-8 py-4 rounded-full text-lg font-medium hover:bg-gray-800 transition-all shadow-2xl flex items-center gap-2 active:scale-95"
          >
            Start Chatting
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
          <button className="px-8 py-4 rounded-full text-lg font-medium text-gray-600 hover:text-black transition-colors">
            Learn More
          </button>
        </motion.div>

        {/* Features Preview */}
        <section id="features" className="mt-40 grid grid-cols-1 md:grid-cols-3 gap-12 text-left w-full">
          <FeatureCard 
            icon={<MessageCircle className="w-6 h-6" />}
            title="Natural Dialogue"
            description="Deep understanding and context-aware responses powered by advanced models."
          />
          <FeatureCard 
            icon={<Zap className="w-6 h-6" />}
            title="Lightning Fast"
            description="Optimized for speed, Keryo responds in real-time to keep your flow going."
          />
          <FeatureCard 
            icon={<Shield className="w-6 h-6" />}
            title="Secure & Private"
            description="Your data is encrypted and secure. We value your privacy as much as you do."
          />
        </section>
        
        {/* Footer Branding */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.4 }}
          transition={{ duration: 1, delay: 1 }}
          className="mt-20 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 flex items-center gap-2"
        >
          <span className="w-8 h-[1px] bg-gray-200"></span>
          Made by Roshan
          <span className="w-8 h-[1px] bg-gray-200"></span>
        </motion.div>
      </main>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <motion.div
      whileHover={{ y: -5 }}
      className="p-8 rounded-3xl bg-white/50 backdrop-blur-md border border-gray-100 hover:border-gray-200 hover:shadow-xl transition-all"
    >
      <div className="w-12 h-12 rounded-2xl bg-black text-white flex items-center justify-center mb-6">
        {icon}
      </div>
      <h3 className="text-xl font-semibold text-gray-900 mb-3">{title}</h3>
      <p className="text-gray-500 leading-relaxed">{description}</p>
    </motion.div>
  );
}
