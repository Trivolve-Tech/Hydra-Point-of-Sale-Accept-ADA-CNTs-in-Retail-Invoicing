import { FiLoader } from "react-icons/fi";

const Loader = () => {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <FiLoader className="animate-spin" size={24} />
    </div>
  );
};

export default Loader;
