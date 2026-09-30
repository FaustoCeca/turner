"use client";

import { Loader2, X } from "lucide-react";
import { createContext, useContext, useEffect, useRef, useTransition, type ComponentProps, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { cn } from "@/lib/cn";

export { cn };

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "dark";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-brand text-white hover:brightness-110 disabled:opacity-60",
  secondary: "bg-white text-ink border border-neutral-200 hover:bg-neutral-50 disabled:opacity-60",
  ghost: "text-ink hover:bg-black/5 disabled:opacity-50",
  danger: "bg-red-600 text-white hover:bg-red-700 disabled:opacity-60",
  dark: "bg-brand-dark text-white hover:brightness-125 disabled:opacity-60",
};

export function Button({
  variant = "primary",
  className,
  loading,
  children,
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant; loading?: boolean }) {
  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed",
        variants[variant],
        className,
      )}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

const PendingContext = createContext(false);

/**
 * Formulario que envía con una acción (server action / useActionState) SIN vaciar los campos.
 * Con `<form action>` React 19 resetea los campos al terminar, aunque la respuesta sea un error,
 * y el usuario pierde lo que escribió.
 */
export function ActionForm({
  action,
  ...props
}: Omit<ComponentProps<"form">, "action" | "onSubmit"> & { action: (formData: FormData) => void }) {
  const [pending, startTransition] = useTransition();
  return (
    <PendingContext.Provider value={pending}>
      <form
        {...props}
        onSubmit={(e) => {
          e.preventDefault();
          // El botón que envió (name/value) también viaja, igual que con un envío normal.
          const formData = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
          startTransition(() => action(formData));
        }}
      />
    </PendingContext.Provider>
  );
}

/** Botón de envío que muestra el estado pendiente del formulario (server actions). */
export function SubmitButton({ children, ...props }: ComponentProps<typeof Button>) {
  const { pending } = useFormStatus();
  const actionFormPending = useContext(PendingContext);
  return (
    <Button type="submit" loading={pending || actionFormPending} {...props}>
      {children}
    </Button>
  );
}

export function Label({ className, ...props }: ComponentProps<"label">) {
  return <label {...props} className={cn("mb-1 block text-sm font-medium text-ink", className)} />;
}

const fieldBase =
  "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-ink outline-none transition placeholder:text-neutral-400 focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:bg-neutral-100";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input {...props} className={cn(fieldBase, className)} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea {...props} className={cn(fieldBase, "min-h-24", className)} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select {...props} className={cn(fieldBase, "pr-8", className)} />;
}

export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label>{label}</Label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-neutral-500">{hint}</p>}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function Checkbox({
  label,
  hint,
  className,
  ...props
}: ComponentProps<"input"> & { label: ReactNode; hint?: ReactNode }) {
  return (
    <label className={cn("flex cursor-pointer items-start gap-2.5 text-sm", className)}>
      <input type="checkbox" {...props} className="mt-0.5 size-4 shrink-0 accent-[var(--brand)]" />
      <span>
        {label}
        {hint && <span className="block text-xs text-neutral-500">{hint}</span>}
      </span>
    </label>
  );
}

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div {...props} className={cn("rounded-xl border border-neutral-200 bg-white", className)} />;
}

export function Badge({
  tone = "neutral",
  className,
  ...props
}: ComponentProps<"span"> & { tone?: "neutral" | "green" | "red" | "yellow" | "blue" | "brand" }) {
  const tones = {
    neutral: "bg-neutral-100 text-neutral-700 border-neutral-200",
    green: "bg-emerald-50 text-emerald-700 border-emerald-200",
    red: "bg-red-50 text-red-700 border-red-200",
    yellow: "bg-amber-50 text-amber-800 border-amber-200",
    blue: "bg-sky-50 text-sky-700 border-sky-200",
    brand: "brand-soft text-brand border-transparent",
  };
  return (
    <span
      {...props}
      className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium", tones[tone], className)}
    />
  );
}

export function Alert({ tone = "red", children }: { tone?: "red" | "green" | "yellow" | "blue"; children: ReactNode }) {
  const tones = {
    red: "bg-red-50 text-red-700 border-red-200",
    green: "bg-emerald-50 text-emerald-800 border-emerald-200",
    yellow: "bg-amber-50 text-amber-800 border-amber-200",
    blue: "bg-sky-50 text-sky-800 border-sky-200",
  };
  return <div role="alert" className={cn("rounded-lg border px-3 py-2 text-sm", tones[tone])}>{children}</div>;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "md" | "lg";
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={cn(
        "m-auto max-h-[92dvh] w-[calc(100%-1.5rem)] overflow-hidden rounded-xl bg-white p-0 text-ink shadow-2xl backdrop:bg-black/40",
        size === "lg" ? "max-w-2xl" : "max-w-lg",
      )}
    >
      {open && (
        // El foco inicial va al contenedor para no resaltar el primer botón como si estuviera elegido.
        <div className="flex max-h-[92dvh] flex-col outline-none animate-rise" tabIndex={-1} autoFocus>
          {title !== undefined && (
            <div className="flex items-center justify-between gap-4 border-b border-neutral-100 px-5 py-4">
              <div className="text-lg font-bold">{title}</div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar"
                className="rounded-full p-1 text-neutral-500 hover:bg-neutral-100"
              >
                <X className="size-5" />
              </button>
            </div>
          )}
          <div className="overflow-y-auto px-5 py-4">{children}</div>
          {footer && <div className="border-t border-neutral-100 px-5 py-4">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}

export function Avatar({ name, src, size = 32 }: { name: string; src?: string | null; size?: number }) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" width={size} height={size} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />;
  }
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-brand-dark font-medium text-white"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials}
    </span>
  );
}
