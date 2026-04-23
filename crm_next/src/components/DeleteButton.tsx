"use client";

import { useRef } from "react";

type Props = {
  action: (fd: FormData) => void | Promise<void>;
  idx: number;
  label: string;
  returnUrl: string;
  confirmText?: string;
  children?: React.ReactNode;
  className?: string;
};

export default function DeleteButton({
  action,
  idx,
  label,
  returnUrl,
  confirmText,
  children,
  className,
}: Props) {
  const formRef = useRef<HTMLFormElement>(null);

  function onClick(e: React.MouseEvent) {
    const msg = confirmText ?? `[${label}] 을(를) 삭제하시겠습니까?`;
    if (!confirm(msg)) {
      e.preventDefault();
    } else {
      formRef.current?.requestSubmit();
    }
  }

  return (
    <form ref={formRef} action={action} style={{ display: "inline" }}>
      <input type="hidden" name="idx" value={idx} />
      <input type="hidden" name="return_url" value={returnUrl} />
      <button
        type="button"
        onClick={onClick}
        className={className ?? "btn btn-sm btn-outline-danger py-0 px-1"}
      >
        {children ?? "삭제"}
      </button>
    </form>
  );
}
