import React from 'react';
import ReactPaginate from 'react-paginate';

export default function ReactPaginator({ totalRecords, rows, first, onPageChange }) {
  const pageCount = Math.ceil(totalRecords / rows);
  if (pageCount <= 1) return null;

  const currentPage = Math.floor(first / rows);

  const handlePageClick = (selectedItem) => {
    const pageNum = selectedItem.selected;
    onPageChange({
      first: pageNum * rows,
      page: pageNum,
      rows: rows
    });
  };

  const handleFirstPage = () => {
    if (currentPage > 0) {
      onPageChange({ first: 0, page: 0, rows });
    }
  };

  const handleLastPage = () => {
    if (currentPage < pageCount - 1) {
      const lastPageIdx = pageCount - 1;
      onPageChange({ first: lastPageIdx * rows, page: lastPageIdx, rows });
    }
  };

  const PaginateComponent = ReactPaginate.default || ReactPaginate;

  return (
    <div className="flex items-center justify-center gap-1.5 py-3 select-none">
      {/* First Page Button */}
      <button
        onClick={handleFirstPage}
        disabled={currentPage === 0}
        className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-blue-600 hover:bg-slate-50 border border-slate-200/80 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-500 transition-all font-semibold rounded-none cursor-pointer"
        title="First Page"
      >
        <span className="text-[10px] font-bold">|&lt;</span>
      </button>

      <PaginateComponent
        breakLabel="..."
        nextLabel=">"
        onPageChange={handlePageClick}
        pageRangeDisplayed={3}
        marginPagesDisplayed={1}
        pageCount={pageCount}
        previousLabel="<"
        renderOnZeroPageCount={null}
        forcePage={currentPage}
        
        // Tailwind styling classes
        containerClassName="flex items-center gap-1.5 list-none m-0 p-0"
        
        pageClassName="inline-block"
        pageLinkClassName="w-8 h-8 flex items-center justify-center text-slate-600 hover:text-blue-600 hover:bg-slate-50 border border-slate-200/80 transition-all font-bold text-xs rounded-none cursor-pointer"
        
        activeClassName="active-page"
        activeLinkClassName="!bg-blue-600 !text-white !border-blue-600"
        
        previousClassName="inline-block"
        previousLinkClassName="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-blue-600 hover:bg-slate-50 border border-slate-200/80 transition-all font-bold text-xs rounded-none cursor-pointer"
        
        nextClassName="inline-block"
        nextLinkClassName="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-blue-600 hover:bg-slate-50 border border-slate-200/80 transition-all font-bold text-xs rounded-none cursor-pointer"
        
        breakClassName="inline-block"
        breakLinkClassName="w-8 h-8 flex items-center justify-center text-slate-400 font-bold text-xs border border-transparent rounded-none"
        
        disabledClassName="opacity-30 pointer-events-none"
      />

      {/* Last Page Button */}
      <button
        onClick={handleLastPage}
        disabled={currentPage === pageCount - 1}
        className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-blue-600 hover:bg-slate-50 border border-slate-200/80 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-500 transition-all font-semibold rounded-none cursor-pointer"
        title="Last Page"
      >
        <span className="text-[10px] font-bold">&gt;|</span>
      </button>
    </div>
  );
}
