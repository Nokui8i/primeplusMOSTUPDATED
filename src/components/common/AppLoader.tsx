import NewLogo from './NewLogo';
import { motion, AnimatePresence } from 'framer-motion';

export default function AppLoader({ isVisible = true }: { isVisible?: boolean }) {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          key="apploader"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: 'easeInOut' }}
          className="fixed inset-0 flex flex-col items-center justify-center"
          style={{ 
            margin: 0, 
            padding: 0, 
            border: 'none', 
            outline: 'none',
            width: '100vw',
            height: '100vh',
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 999999,
            backgroundColor: '#ffffff'
          }}
        >
          {/* Clean white background */}
          <div 
            className="absolute inset-0 bg-white" 
            style={{ 
              margin: 0, 
              padding: 0, 
              border: 'none',
              width: '100vw',
              height: '100vh',
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0
            }}
          ></div>
          
          {/* Logo with animation */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ 
              scale: [0.8, 1.05, 1],
              opacity: [0, 1, 1]
            }}
            transition={{ 
              duration: 1.2, 
              ease: 'easeOut',
              times: [0, 0.6, 1]
            }}
            className="z-10 mb-12"
          >
              <NewLogo size="xxxl" showText={false} />
          </motion.div>

          {/* Loading dots */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.5 }}
            className="flex space-x-3 z-10"
          >
            {[0, 1, 2].map((index) => (
              <motion.div
                key={index}
                className="w-4 h-4 bg-blue-500 rounded-full"
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.5, 1, 0.5]
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  delay: index * 0.2,
                  ease: 'easeInOut'
                }}
              />
            ))}
          </motion.div>

              {/* Loading text */}
        </motion.div>
      )}
    </AnimatePresence>
  );
} 