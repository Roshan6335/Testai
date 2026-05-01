import { lazy, Suspense, Component, type ReactNode } from 'react';
import { motion, useScroll, useTransform } from 'motion/react';
import KeryoLogo from './KeryoLogo';
import { ArrowRight, Sparkles, MessageCircle, Shield, Zap, Code2, PenTool, Database, Globe, Users, Heart, Star } from 'lucide-react';

// Lazy-load ThreeBackground to avoid loading 800KB+ of three.js on initial page load
const ThreeBackground = lazy(() => import('./ThreeBackground'));

// WebGL error boundary — catches crashes from unsupported browsers/devices
class WebGLErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      // Fallback: plain white background
      return <div className="fixed inset-0 -z-10 bg-white" />;
    }
    return this.props.children;
  }
}

export default function LandingPage({ onGetStarted }: { onGetStarted: () => void }) {
  const { scrollYProgress } = useScroll();
  const y = useTransform(scrollYProgress, [0, 1], [0, -50]);

  return (
    <div className="relative min-h-screen overflow-hidden selection:bg-black selection:text-white">
      <WebGLErrorBoundary>
        <Suspense fallback={<div className="fixed inset-0 -z-10 bg-white" />}>
          <ThreeBackground />
        </Suspense>
      </WebGLErrorBoundary>
      
      {/* Navigation */}
      <nav className="relative z-10 flex items-center justify-between p-6 max-w-7xl mx-auto backdrop-blur-sm bg-white/30 sticky top-0 border-b border-gray-100/50">
        <div className="flex items-center gap-3">
          <KeryoLogo className="w-10 h-10" />
          <span className="text-xl font-semibold tracking-tight text-gray-900">Keryo</span>
        </div>
        <div className="flex items-center gap-8">
          <a href="#features" className="text-sm font-medium text-gray-500 hover:text-black transition-colors hidden md:block">Features</a>
          <a href="#capabilities" className="text-sm font-medium text-gray-500 hover:text-black transition-colors hidden md:block">Capabilities</a>
          <a href="#testimonials" className="text-sm font-medium text-gray-500 hover:text-black transition-colors hidden md:block">Testimonials</a>
          <button 
            onClick={onGetStarted}
            className="bg-black text-white px-6 py-2.5 rounded-full text-sm font-medium hover:bg-gray-800 transition-all shadow-lg active:scale-95 flex items-center gap-2 group"
          >
            Get Started
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="relative z-10 pt-32 pb-32 px-6 max-w-7xl mx-auto flex flex-col items-center text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2 bg-white/80 backdrop-blur-md px-4 py-2 rounded-full border border-gray-200 mb-8 shadow-sm"
        >
          <Sparkles className="w-4 h-4 text-gray-900" />
          <span className="text-xs font-semibold text-gray-800 tracking-wide uppercase">The minimalist AI companion</span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-6xl md:text-8xl lg:text-[10rem] font-medium tracking-tighter text-gray-900 mb-8 leading-none"
        >
          Intelligence,<br />
          <span className="text-gray-300">Refined.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-lg md:text-2xl text-gray-500 max-w-2xl mb-12 font-light"
        >
          Keryo is built for absolute clarity. A beautifully crafted, advanced AI interface that fits seamlessly into your workflow. Pure focus, zero distractions.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="flex flex-col sm:flex-row items-center gap-6 relative z-20"
        >
          <button
            onClick={onGetStarted}
            className="group bg-black text-white px-10 py-5 rounded-full text-lg font-semibold hover:bg-gray-800 transition-all shadow-2xl hover:shadow-black/20 flex items-center gap-3 active:scale-95"
          >
            Start Chatting Free
            <ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform" />
          </button>
        </motion.div>

        {/* Dashboard Preview mockup */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.5 }}
          style={{ y }}
          className="mt-32 w-full max-w-5xl rounded-[2rem] border border-gray-200/50 bg-white/40 backdrop-blur-3xl shadow-2xl overflow-hidden aspect-[16/9] relative p-2"
        >
          <div className="absolute inset-0 bg-gradient-to-tr from-gray-50/50 to-white/50" />
          <div className="relative h-full w-full rounded-[1.5rem] bg-white border border-gray-100 shadow-inner overflow-hidden flex flex-col">
            <div className="h-12 border-b border-gray-100 flex items-center px-4 gap-2">
              <div className="w-3 h-3 rounded-full bg-gray-200" />
              <div className="w-3 h-3 rounded-full bg-gray-200" />
              <div className="w-3 h-3 rounded-full bg-gray-200" />
            </div>
            <div className="flex-1 p-8 flex flex-col gap-6">
              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-gray-100" />
                <div className="h-16 w-64 bg-gray-50 rounded-2xl rounded-tl-none border border-gray-100" />
              </div>
              <div className="flex gap-4 flex-row-reverse">
                <div className="w-8 h-8 rounded-full bg-black flex items-center justify-center">
                  <KeryoLogo className="w-4 h-4 text-white" />
                </div>
                <div className="h-32 w-full max-w-md bg-gray-50 rounded-2xl rounded-tr-none border border-gray-100 p-4 space-y-3">
                  <div className="h-3 w-3/4 bg-gray-200 rounded-full" />
                  <div className="h-3 w-full bg-gray-200 rounded-full" />
                  <div className="h-3 w-5/6 bg-gray-200 rounded-full" />
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Features Preview */}
        <section id="features" className="mt-40 grid grid-cols-1 md:grid-cols-3 gap-8 text-left w-full max-w-6xl">
          <FeatureCard 
            icon={<MessageCircle className="w-6 h-6" />}
            title="Natural Dialogue"
            description="Deep understanding and context-aware responses powered by state-of-the-art foundation models."
          />
          <FeatureCard 
            icon={<Zap className="w-6 h-6" />}
            title="Lightning Fast"
            description="Optimized for immediate response times. Keryo streams thought processes in real-time."
          />
          <FeatureCard 
            icon={<Shield className="w-6 h-6" />}
            title="Enterprise Security"
            description="AES-256 encrypted storage, strict CSP headers, and robust sanitization keep your data entirely yours."
          />
        </section>

        {/* Capabilities Grid */}
        <section id="capabilities" className="mt-40 w-full max-w-6xl text-left">
          <div className="mb-16 text-center">
             <h2 className="text-4xl md:text-5xl font-semibold tracking-tight text-gray-900 mb-4">Limitless Capabilities</h2>
             <p className="text-lg text-gray-500">Everything you need to think better, work faster, and create more.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
             <CapabilityBox icon={<Code2 />} title="Code Generation" desc="Write, debug, and optimize complex software architectures." />
             <CapabilityBox icon={<PenTool />} title="Image Creation" desc="Generate stunning visual assets directly in your chat." />
             <CapabilityBox icon={<Globe />} title="Web Search" desc="Pull real-time information and live data instantly." />
             <CapabilityBox icon={<Database />} title="PDF Analysis" desc="Chat with your documents locally with zero privacy loss." />
          </div>
        </section>

        {/* Testimonials */}
        <section id="testimonials" className="mt-40 w-full max-w-6xl">
           <div className="p-12 md:p-20 bg-gray-50 rounded-[3rem] border border-gray-100 relative overflow-hidden">
             <div className="absolute top-0 right-0 -mt-20 -mr-20 w-64 h-64 bg-gray-200/50 rounded-full blur-3xl" />
             <div className="relative z-10 text-left">
               <div className="flex gap-1 mb-6">
                 {[...Array(5)].map((_, i) => <Star key={i} className="w-5 h-5 fill-black text-black" />)}
               </div>
               <h3 className="text-2xl md:text-4xl font-medium tracking-tight text-gray-900 leading-snug mb-8">
                 "Keryo entirely replaced my need for bulky, ad-filled AI interfaces. The sheer speed and absolute minimalism is exactly what a professional workspace needs."
               </h3>
               <div className="flex items-center gap-4">
                 <div className="w-12 h-12 rounded-full bg-gray-200 border border-gray-300 overflow-hidden flex items-center justify-center font-bold text-gray-400">
                   A
                 </div>
                 <div>
                   <p className="font-semibold text-gray-900">Alexandre</p>
                   <p className="text-sm text-gray-500">Software Architect</p>
                 </div>
               </div>
             </div>
           </div>
        </section>

        {/* CTA */}
        <section className="mt-40 mb-20 text-center">
           <h2 className="text-5xl md:text-7xl font-medium tracking-tighter mb-8">Ready to elevate?</h2>
           <button
            onClick={onGetStarted}
            className="group bg-black text-white px-12 py-6 rounded-full text-xl font-medium hover:bg-gray-800 transition-all shadow-2xl flex items-center gap-3 active:scale-95 mx-auto"
          >
            Get Keryo Pro
            <ArrowRight className="w-6 h-6 group-hover:translate-x-2 transition-transform" />
          </button>
        </section>
        
        {/* Footer Branding */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.4 }}
          transition={{ duration: 1, delay: 1 }}
          className="mt-20 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 flex items-center justify-center gap-4 w-full"
        >
          <span className="w-12 h-[1px] bg-gray-300"></span>
          <span className="flex items-center gap-1">Made with <Heart className="w-3 h-3 text-red-500" /> by Roshan</span>
          <span className="w-12 h-[1px] bg-gray-300"></span>
        </motion.div>
      </main>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <motion.div
      whileHover={{ y: -5 }}
      className="p-8 rounded-3xl bg-white/60 backdrop-blur-xl border border-gray-100 hover:border-gray-200 hover:shadow-2xl hover:shadow-gray-200/50 transition-all group"
    >
      <div className="w-12 h-12 rounded-2xl bg-black text-white flex items-center justify-center mb-6 shadow-md group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <h3 className="text-xl font-semibold text-gray-900 mb-3">{title}</h3>
      <p className="text-gray-500 leading-relaxed">{description}</p>
    </motion.div>
  );
}

function CapabilityBox({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) {
  return (
    <div className="p-6 rounded-3xl border border-gray-100 bg-white hover:bg-gray-50 transition-colors group">
      <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center mb-4 group-hover:bg-black group-hover:text-white transition-colors text-gray-600">
        {icon}
      </div>
      <h4 className="font-semibold text-gray-900 mb-2">{title}</h4>
      <p className="text-sm text-gray-500">{desc}</p>
    </div>
  );
}
