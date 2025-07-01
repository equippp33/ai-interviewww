import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface InstructionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const scrollbarStyles = `
  scrollbar-thin 
  scrollbar-track-transparent 
  scrollbar-thumb-gray-300 
  hover:scrollbar-thumb-gray-400
  scrollbar-thumb-rounded-full
  scroll-smooth
`;

const InstructionDialog = ({ open, onOpenChange }: InstructionDialogProps) => {
  const instructions = [
    {
      category: "Recording & Privacy",
      icon: "🎥",
      items: [
        "Your video and audio responses will be captured securely with your consent",
        "All recordings are encrypted and stored following strict privacy guidelines",
        "Your responses will be analyzed by AI, not by humans",
      ],
    },
    {
      category: "Time Management",
      icon: "⏱️",
      items: [
        "Total interview duration: 15 minutes",
        "Question loading time is not counted in the interview duration",
        "Each question has a 15-second initial response time",
        "You can continue elaborating after 15 seconds if needed",
        "The 'Next Question' button appears after 15 seconds",
        "The interview will end after you answer the first 20 questions, or click 'End Session' to end your session",
      ],
    },
    {
      category: "Technical Requirements",
      icon: "🎧",
      items: [
        "Use external audio devices (headphones) for clear audio capture",
        "Ensure you're in a well-lit, quiet environment",
        "Maintain stable and fast internet connection throughout",
        "Test your camera and microphone before starting",
      ],
    },
    {
      category: "Restricted Actions",
      icon: "⚠️",
      items: [
        "The following keys are restricted during the interview:",
        "• Alt + Tab",
        "• Windows/Command Key",
        "• Ctrl + Tab",
        "• F11 (Fullscreen)",
        "Minimizing window or switching tabs will terminate the interview",
        "Violations result in a 6-hour lockout period",
      ],
    },
    {
      category: "Results & Support",
      icon: "📋",
      items: [
        "Results will be available in your profile within 1-2 days",
        "AI validates responses against question transcripts",
        "For discrepancies between transcripts and answers, contact support",
        <a
          key="support-email"
          href="mailto:developer@equippp.com"
          className="text-blue-600 hover:underline"
        >
          For technical issues or questions, email: developer@equippp.com
        </a>,
      ],
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">
            Interview Instructions & Policies
          </DialogTitle>
        </DialogHeader>

        <ScrollArea
          className={cn(
            "max-h-[70vh] pr-4 transition-all duration-200",
            scrollbarStyles,
          )}
        >
          <div className="space-y-6 py-4">
            {instructions.map((section, index) => (
              <div
                key={index}
                className="transform rounded-lg border border-gray-100 bg-gray-50/50 p-4 shadow-sm transition-all duration-200 hover:scale-[1.01] hover:bg-gray-50/80 hover:shadow-md"
              >
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-2xl">{section.icon}</span>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {section.category}
                  </h3>
                </div>
                <ul className="space-y-2">
                  {section.items.map((item, itemIndex) => (
                    <li
                      key={itemIndex}
                      className="flex items-start gap-2 text-sm text-gray-600"
                    >
                      {typeof item === "string" && !item.startsWith("•") && (
                        <svg
                          className="mt-1 h-4 w-4 flex-shrink-0 text-blue-500"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                      )}
                      <span
                        className={
                          typeof item === "string" && item.startsWith("•")
                            ? "ml-6"
                            : ""
                        }
                      >
                        {item}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default InstructionDialog;
