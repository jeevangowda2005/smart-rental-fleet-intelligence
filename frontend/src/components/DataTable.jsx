import React, { useState } from 'react';
import { Search, ChevronLeft, ChevronRight, SlidersHorizontal } from 'lucide-react';

export const DataTable = ({
  columns,
  data = [],
  searchable = true,
  searchPlaceholder = 'Search records...',
  actions,
  pageSize = 10
}) => {
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const filteredData = data.filter((row) =>
    columns.some((col) => {
      const val = col.accessor ? row[col.accessor] : col.render ? col.render(row) : null;
      if (!val) return false;
      return String(val).toLowerCase().includes(search.toLowerCase());
    })
  );

  const totalPages = Math.ceil(filteredData.length / pageSize) || 1;
  const paginatedData = filteredData.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="bg-industrial-card border border-industrial-border rounded-xl shadow-lg overflow-hidden">
      {/* Table Header Controls */}
      {(searchable || actions) && (
        <div className="p-4 border-b border-industrial-border flex flex-col md:flex-row gap-4 items-center justify-between bg-slate-900/40">
          {searchable && (
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder={searchPlaceholder}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-9 pr-4 py-2 text-sm bg-industrial-bg border border-industrial-border rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cat-500 transition"
              />
            </div>
          )}
          {actions && <div className="flex items-center gap-3 w-full md:w-auto">{actions}</div>}
        </div>
      )}

      {/* Table Content */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="bg-slate-900/80 text-xs uppercase text-slate-400 border-b border-industrial-border tracking-wider font-semibold">
            <tr>
              {columns.map((col, idx) => (
                <th key={idx} className="px-5 py-3.5">
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-industrial-border/60 font-sans">
            {paginatedData.length > 0 ? (
              paginatedData.map((row, rowIdx) => (
                <tr
                  key={row.id || rowIdx}
                  className="hover:bg-slate-900/60 transition duration-150 group"
                >
                  {columns.map((col, colIdx) => (
                    <td key={colIdx} className="px-5 py-4 whitespace-nowrap">
                      {col.render
                        ? col.render(row)
                        : col.accessor
                        ? row[col.accessor]
                        : null}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="px-5 py-12 text-center text-slate-500">
                  No records matching search query.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="p-4 border-t border-industrial-border flex items-center justify-between text-xs text-slate-400 bg-slate-900/30">
        <span>
          Showing <strong className="text-slate-200 font-mono">{filteredData.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}</strong> to{' '}
          <strong className="text-slate-200 font-mono">{Math.min(currentPage * pageSize, filteredData.length)}</strong> of{' '}
          <strong className="text-slate-200 font-mono">{filteredData.length}</strong> entries
        </span>

        <div className="flex items-center gap-2">
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
            className="p-1.5 rounded-lg border border-industrial-border bg-industrial-bg hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-industrial-bg transition"
          >
            <ChevronLeft className="w-4 h-4 text-slate-300" />
          </button>
          <span className="font-mono text-slate-300 px-2">
            Page {currentPage} of {totalPages}
          </span>
          <button
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
            className="p-1.5 rounded-lg border border-industrial-border bg-industrial-bg hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-industrial-bg transition"
          >
            <ChevronRight className="w-4 h-4 text-slate-300" />
          </button>
        </div>
      </div>
    </div>
  );
};
