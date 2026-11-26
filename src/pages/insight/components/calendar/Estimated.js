import React from "react";

export default function Estimated({ title = "Approximate or modelled figure, not an official published number" }) {
  return (
    <span className="mi-badge" title={title}>
      Estimated
    </span>
  );
}
