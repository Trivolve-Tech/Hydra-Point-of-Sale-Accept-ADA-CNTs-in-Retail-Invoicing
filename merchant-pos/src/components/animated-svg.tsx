import { motion } from "framer-motion";

const AnimatedSVG = () => {
  return (
    <div>
      <svg
        width="376"
        height="323"
        viewBox="0 0 376 323"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <motion.circle
          cx="188"
          cy="135"
          r="188"
          fill="white"
          fillOpacity="0.01"
          transition={{ duration: 0.5, delay: 1, ease: "easeIn" }}
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
        />
        {/* Circle 2 */}
        <motion.circle
          cx="188"
          cy="135"
          r="160"
          fill="white"
          fillOpacity="0.02"
          transition={{ duration: 0.5, delay: 0.8, ease: "easeIn" }}
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
        />
        <motion.circle
          cx="188"
          cy="135"
          r="124"
          fill="white"
          fillOpacity="0.04"
          transition={{ duration: 0.5, delay: 0.6, ease: "easeIn" }}
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
        />
        <motion.circle
          cx="188"
          cy="135"
          r="88"
          fill="white"
          transition={{ duration: 0.5, delay: 0.4, ease: "easeIn" }}
          initial={{ opacity: 0, scale: 1.2 }}
          whileInView={{ opacity: 1, scale: 1 }}
        />
        <motion.path
          d="M238.664 107.333L175.331 170.667L143.664 139"
          stroke="black"
          strokeWidth="12"
          strokeLinecap="round"
          strokeLinejoin="round"
          transition={{ duration: 0.5, delay: 0.4, ease: "easeIn" }}
          initial={{ opacity: 0, scale: 1.2 }}
          whileInView={{ opacity: 1, scale: 1 }}
        />
      </svg>
    </div>
  );
};

export default AnimatedSVG;
