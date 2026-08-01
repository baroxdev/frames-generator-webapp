import clsx from "clsx";

import { Template } from "../templates/types";

interface TemplateGalleryProps {
  templates: Template[];
  selectedId: string;
  onSelect: (id: string) => void;
}

const TemplateGallery = ({
  templates,
  selectedId,
  onSelect,
}: TemplateGalleryProps) => {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-slate-700">Chọn mẫu khung</span>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {templates.map((template) => (
          <button
            key={template.id}
            type="button"
            title={template.description}
            onClick={() => onSelect(template.id)}
            className={clsx(
              "flex-shrink-0 w-24 rounded-lg border-2 overflow-hidden text-left transition-colors",
              template.id === selectedId
                ? "border-blue-600"
                : "border-transparent hover:border-slate-300",
            )}
          >
            <img
              src={template.background}
              alt={template.name}
              className="w-full h-16 object-cover"
            />
            <span className="block px-1 py-1 text-xs text-slate-600 truncate">
              {template.name}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default TemplateGallery;
