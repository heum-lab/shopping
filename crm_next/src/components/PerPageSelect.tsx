"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

export default function PerPageSelect({ value, options }: { value: number; options: number[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = new URLSearchParams(sp.toString());
    next.set("per_page", e.target.value);
    next.set("page", "1");
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <select className="form-select form-select-sm" style={{ width: "auto" }} value={value} onChange={onChange}>
      {options.map((pp) => (
        <option key={pp} value={pp}>{pp}개</option>
      ))}
    </select>
  );
}
