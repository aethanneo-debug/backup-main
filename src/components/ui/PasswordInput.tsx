import React, { useEffect, useId, useRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

type PasswordInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & {
  /** "dark" for the sign-in card, "light" for forms on white. */
  tone?: "dark" | "light";
};

const TOGGLE_TONE = {
  dark: "text-slate-400 hover:text-slate-200",
  light: "text-slate-500 hover:text-slate-700"
};

/**
 * A password box with an eye button that shows what was typed, so the person can check it
 * before sending it. It starts hidden and hides again when its form is submitted: the password
 * isn't left on screen, and the browser still sees a password field being sent.
 */
export default function PasswordInput({ tone = "light", className = "", id, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const fallbackId = useId();
  const inputId = id ?? fallbackId;
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const form = inputRef.current?.form;
    if (!form) return;
    const hide = () => setVisible(false);
    form.addEventListener("submit", hide);
    return () => form.removeEventListener("submit", hide);
  }, []);

  return (
    <div className="relative">
      {/* pr-10 keeps what is typed clear of the eye button. */}
      <input {...props} ref={inputRef} id={inputId} type={visible ? "text" : "password"} className={`${className} pr-10`} />
      <button
        type="button"
        onClick={() => setVisible(v => !v)}
        // One name with a pressed state, as a toggle button should have; the tooltip says what a
        // click does next.
        aria-label="Show password"
        aria-pressed={visible}
        aria-controls={inputId}
        title={visible ? "Hide password" : "Show password"}
        className={`absolute inset-y-0 right-0 flex cursor-pointer items-center rounded-r-xl px-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 ${TOGGLE_TONE[tone]}`}
      >
        {visible ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
      </button>
    </div>
  );
}
