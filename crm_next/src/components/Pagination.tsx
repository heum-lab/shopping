import Link from "next/link";
import { buildQs, type SearchMap } from "@/lib/qs";

type Props = {
  page: number;
  totalPages: number;
  basePath: string;
  params: SearchMap;
  range?: number;
};

export default function Pagination({ page, totalPages, basePath, params, range = 5 }: Props) {
  if (totalPages <= 1) return null;
  const start = Math.max(1, page - range);
  const end   = Math.min(totalPages, page + range);
  const link  = (p: number) => `${basePath}?${buildQs(params, { page: p })}`;

  const items: React.ReactNode[] = [];
  if (page > 1) {
    items.push(<li key="first" className="page-item"><Link className="page-link" href={link(1)}>«</Link></li>);
    items.push(<li key="prev"  className="page-item"><Link className="page-link" href={link(page - 1)}>‹</Link></li>);
  }
  for (let i = start; i <= end; i++) {
    items.push(
      <li key={i} className={`page-item ${i === page ? "active" : ""}`}>
        <Link className="page-link" href={link(i)}>{i}</Link>
      </li>
    );
  }
  if (page < totalPages) {
    items.push(<li key="next" className="page-item"><Link className="page-link" href={link(page + 1)}>›</Link></li>);
    items.push(<li key="last" className="page-item"><Link className="page-link" href={link(totalPages)}>»</Link></li>);
  }

  return (
    <div className="pagination-wrapper">
      <ul className="pagination pagination-sm">{items}</ul>
    </div>
  );
}
