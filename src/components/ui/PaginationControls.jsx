import { ChevronLeft, ChevronRight } from 'lucide-react';

const PAGE_SIZE_OPTIONS = [10, 25, 50];

const PaginationControls = ({
  page,
  pageSize,
  totalCount,
  onPageChange,
  onPageSizeChange,
  itemLabel = 'records',
}) => {
  const safeTotal = totalCount || 0;
  const totalPages = Math.max(1, Math.ceil(safeTotal / pageSize));
  const start = safeTotal === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, safeTotal);

  return (
    <div className="flex flex-col gap-3 border-t border-border bg-bg-primary/50 p-3 text-xs font-semibold text-text-muted sm:flex-row sm:items-center sm:justify-between">
      <div>
        Showing <span className="font-data text-text-primary">{start}-{end}</span> of{' '}
        <span className="font-data text-text-primary">{safeTotal}</span> {itemLabel}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2">
          <span>Rows</span>
          <select
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            className="rounded border border-border bg-bg-primary px-2 py-1 text-xs text-text-primary focus:border-accent focus:outline-none"
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        </label>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="inline-flex h-8 w-8 items-center justify-center rounded border border-border text-text-secondary transition-colors hover:bg-bg-elevated hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Previous page"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="font-data text-text-secondary">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className="inline-flex h-8 w-8 items-center justify-center rounded border border-border text-text-secondary transition-colors hover:bg-bg-elevated hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Next page"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaginationControls;
