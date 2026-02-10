import { IoCheckmark } from "react-icons/io5";

const ProgressFlow = ({ currentStep }: { currentStep: number }) => {
  const steps = [
    { label: "Awaiting deposit", id: 0 },
    { label: "Confirming", id: 1 },
  ];
  return (
    <div className="flex w-full items-center justify-between rounded-full border border-white/10 p-2 px-10 md:justify-around md:px-0">
      {steps.map((step) => (
        <div key={step.id} className="flex flex-col items-center">
          <div className="relative flex w-full items-center justify-between">
            <div
              className={`relative z-[9999] flex h-6 w-6 items-center justify-center rounded-full ${currentStep >= step.id ? "bg-white" : "relative z-50 border border-secondary/50"} `}
            >
              {currentStep >= step.id ? (
                <IoCheckmark className="text-[#1C1B1F]" size={12} />
              ) : (
                <span className="h-2 w-2 rounded-full bg-[#949494]" />
              )}
            </div>
            <span
              className={`absolute left-1/2 top-10 block w-auto min-w-[120px] -translate-x-1/2 text-center font-helviatica-regular text-xs md:text-sm ${
                currentStep >= step.id ? "text-white" : "text-[#949494]"
              }`}
            >
              {step.label}
            </span>
            {step.id === 0 && (
              <div
                className={`absolute left-0 top-1/2 z-0 h-[1px] w-[calc(100vw-160px-24px)] -translate-y-1/2 md:w-[calc(100vw-1620px)] ${currentStep > step.id ? "bg-white" : "border border-dashed border-[#949494]"}`}
              />
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default ProgressFlow;
