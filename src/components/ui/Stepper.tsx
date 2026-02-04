interface StepperProps {
  steps: string[];
  currentStep: number;
  completedSteps?: number; // 已完成的步骤数，默认等于 currentStep - 1
  onStepClick?: (step: number) => void;
}

export function Stepper({ steps, currentStep, completedSteps, onStepClick }: StepperProps) {
  // 如果没有指定 completedSteps，则已完成的步骤数为 currentStep - 1
  const actualCompletedSteps = completedSteps ?? currentStep - 1;

  return (
    <div className="w-full">
      {/* 桌面视图 */}
      <div className="hidden sm:flex items-center justify-between">
        {steps.map((step, index) => {
          const stepNumber = index + 1;
          const isCompleted = stepNumber <= actualCompletedSteps;
          const isCurrent = stepNumber === currentStep;
          // 允许点击已完成的步骤或当前步骤
          const isClickable = onStepClick && (stepNumber <= actualCompletedSteps || stepNumber === currentStep);

          return (
            <div key={step} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                {/* 步骤圆点 */}
                <button
                  onClick={() => isClickable && onStepClick(stepNumber)}
                  disabled={!isClickable}
                  className={`
                    w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium
                    transition-all duration-200
                    ${isCompleted
                      ? 'bg-green-600 text-white'
                      : isCurrent
                        ? 'bg-blue-600 text-white ring-4 ring-blue-600/30'
                        : 'bg-slate-700 text-slate-400'
                    }
                    ${isClickable ? 'cursor-pointer hover:scale-105' : 'cursor-default'}
                  `}
                >
                  {isCompleted ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    stepNumber
                  )}
                </button>

                {/* 步骤名称 */}
                <span
                  className={`
                    mt-2 text-sm font-medium
                    ${isCurrent ? 'text-blue-400' : isCompleted ? 'text-green-400' : 'text-slate-500'}
                  `}
                >
                  {step}
                </span>
              </div>

              {/* 连接线 */}
              {index < steps.length - 1 && (
                <div className="flex-1 h-0.5 mx-2 mt-[-24px]">
                  <div
                    className={`h-full transition-all duration-500 ${
                      stepNumber <= actualCompletedSteps ? 'bg-green-600' : 'bg-slate-700'
                    }`}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 移动端视图 */}
      <div className="sm:hidden">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-slate-400">
            步骤 {currentStep}/{steps.length}
          </span>
          <span className="text-sm font-medium text-blue-400">{steps[currentStep - 1]}</span>
        </div>
        <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-600 transition-all duration-300"
            style={{ width: `${(Math.max(actualCompletedSteps, currentStep) / steps.length) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
