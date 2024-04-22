// from https://medium.com/@dimterion/modals-with-html-dialog-element-in-javascript-and-react-fb23c885d62e
import React, { useEffect, useRef } from "react";

export default function Dialog({ openModal, closeModal, children }) {
  const ref = useRef();

  useEffect(() => {
    if (openModal) {
      ref.current?.showModal();
    } else {
      ref.current?.close();
    }
  }, [openModal]);

  // useEffect(() => {
  //   const dialog = ref.current;
  //   const handler = e => {
  //     e.preventDefault();
  //     closeModal();
  //   };
  //   dialog.addEventListener("close", handler);
  //   dialog.addEventListener("cancel", handler);
  //   return () => {
  //     dialog.removeEventListener("close", handler);
  //     dialog.removeEventListener("cancel", handler);
  //   };
  // }, [closeModal]);

  return (
    <dialog
      ref={ref}
      onCancel={closeModal}
      className="bch"
    >
      {children}
      <div>
        <button onClick={closeModal} className="flex h-12 max-w-xs
            items-center justify-center rounded-lg bg-foreground px-6 text-lg text-text
            hover:bg-foreground-600 active:bg-foreground-700 disabled:bg-foreground-200 font-bold">
          Close
        </button>
      </div>
    </dialog>
  );
}