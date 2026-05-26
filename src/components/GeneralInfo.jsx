import { useMemo, useState, useEffect } from "react";
import { uploadToCloudinary } from "../lib/cloudinary";
import { formatDisplayDate } from "../lib/date";
import { supabase } from "../lib/supabase";
import {
  FileImage,
  FileText,
  FileSpreadsheet,
  Box,
  FileType,
  File,
  X,
} from "lucide-react";
import { lockBodyScroll, unlockBodyScroll } from "../lib/modalScrollLock";
import { notifyConfirm, notifyError } from "../lib/notify";

const emptyInfo = [
  ["Company", "-"],
  ["Project", "-"],
  ["Description", "-"],
  ["Request Date", "-"],
  ["Initial Date", "-"],
];

const approvalTypes = [
  { key: "sketsa", label: "Sketsa" },
  { key: "shop_drawing", label: "Shop Drawing" },
  { key: "tech_drawing", label: "Tech Drawing" },
  { key: "index_bom", label: "Index BOM" },
  { key: "carton_box", label: "Carton Box" },
];

const statusWeights = {
  EMPTY: 0,
  REVISION_REQUESTED: 35,
  PENDING: 70,
  APPROVED: 100,
};

const statusDisplay = {
  APPROVED: { label: "Approved", tone: "approved" },
  PENDING: { label: "Need Review", tone: "review" },
  REVISION_REQUESTED: { label: "Revision Required", tone: "revision" },
  EMPTY: { label: "Missing Upload", tone: "missing" },
};

const getNormalizedFiles = (revision) => {
  if (Array.isArray(revision?.files)) return revision.files;
  if (revision?.file_url) {
    return [{ url: revision.file_url, name: revision.file_name || "File" }];
  }
  return [];
};

const getLatestStageStatus = (record) => {
  const revisions = Array.isArray(record?.revisions) ? record.revisions : [];
  const latest = revisions[revisions.length - 1];
  if (!latest) return "EMPTY";
  const files = getNormalizedFiles(latest);
  if (!files.length) return "EMPTY";
  return latest.status || "PENDING";
};

export default function GeneralInfo({ project }) {
  const [uploading, setUploading] = useState(false);
  const [files, setFiles] = useState([]);
  const [progressSummary, setProgressSummary] = useState(null);
  const [previewFile, setPreviewFile] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(false);
  const [previewDocHtml, setPreviewDocHtml] = useState("");
  const [previewSheetRows, setPreviewSheetRows] = useState([]);
  const [previewSheetName, setPreviewSheetName] = useState("");

  useEffect(() => {
    if (!project?.id) {
      setFiles([]);
      setProgressSummary(null);
      setPreviewFile(null);
      return;
    }

    const fetchFiles = async () => {
      try {
        const { data, error } = await supabase
          .from("project_files")
          .select("*")
          .eq("project_id", project.id)
          .order("uploaded_at", { ascending: false });

        if (error) throw error;
        setFiles(data || []);
      } catch (error) {
        console.error("Error fetching project files:", error);
      }
    };

    fetchFiles();
  }, [project?.id]);

  useEffect(() => {
    if (!project?.id) {
      setProgressSummary(null);
      return;
    }

    const fetchProgressSummary = async () => {
      try {
        const { data: orderItems, error: itemsError } = await supabase
          .from("order_items")
          .select("id, target_date")
          .eq("project_id", project.id);

        if (itemsError) throw itemsError;

        const items = orderItems || [];
        if (!items.length) {
          setProgressSummary({
            progress: 0,
            totalStages: 0,
            completedEquivalent: 0,
            stats: Object.entries(statusDisplay).map(([status, config]) => ({
              status,
              ...config,
              count: 0,
              percent: 0,
            })),
            overdueItems: 0,
            missingStages: 0,
          });
          return;
        }

        const itemIds = items.map((item) => item.id);
        const { data: approvalData, error: approvalsError } = await supabase
          .from("product_approvals")
          .select("order_item_id, approval_type, revisions")
          .in("order_item_id", itemIds);

        if (approvalsError) throw approvalsError;

        const approvalLookup = new Map();
        (approvalData || []).forEach((record) => {
          approvalLookup.set(`${record.order_item_id}:${record.approval_type}`, record);
        });

        const counts = {
          APPROVED: 0,
          PENDING: 0,
          REVISION_REQUESTED: 0,
          EMPTY: 0,
        };

        let score = 0;
        items.forEach((item) => {
          approvalTypes.forEach((type) => {
            const record = approvalLookup.get(`${item.id}:${type.key}`);
            const status = getLatestStageStatus(record);
            counts[status] += 1;
            score += statusWeights[status] || 0;
          });
        });

        const totalStages = items.length * approvalTypes.length;
        const progress = totalStages ? Math.round(score / totalStages) : 0;
        const overdueItems = items.filter((item) => {
          if (!item.target_date) return false;
          return new Date(item.target_date).getTime() < new Date().getTime();
        }).length;

        setProgressSummary({
          progress,
          totalStages,
          completedEquivalent: Math.round(score / 100),
          stats: Object.entries(statusDisplay).map(([status, config]) => ({
            status,
            ...config,
            count: counts[status],
            percent: totalStages ? Math.round((counts[status] / totalStages) * 100) : 0,
          })),
          overdueItems,
          missingStages: counts.EMPTY,
        });
      } catch (error) {
        console.error("Error fetching progress summary:", error);
        setProgressSummary(null);
      }
    };

    fetchProgressSummary();
  }, [project?.id]);

  useEffect(() => {
    if (!previewFile) return undefined;

    lockBodyScroll();
    return () => unlockBodyScroll();
  }, [previewFile]);

  useEffect(() => {
    if (!previewFile) {
      setPreviewLoading(false);
      setPreviewError(false);
      setPreviewDocHtml("");
      setPreviewSheetRows([]);
      setPreviewSheetName("");
      return;
    }

    const ext = previewFile.file_name.split(".").pop().toLowerCase();
    const isImage = previewFile.file_type?.includes("image") || ["jpg", "jpeg", "png", "gif", "webp"].includes(ext);
    const isPdf = previewFile.file_type?.includes("pdf") || ext === "pdf";
    const isDoc = ["doc", "docx"].includes(ext);
    const isSheet = ["xls", "xlsx", "csv"].includes(ext);
    setPreviewLoading(isImage || isPdf || isDoc || isSheet);
    setPreviewError(false);
    setPreviewDocHtml("");
    setPreviewSheetRows([]);
    setPreviewSheetName("");

    let cancelled = false;

    const loadStructuredPreview = async () => {
      try {
        if (isDoc) {
          const mammoth = await import("mammoth/mammoth.browser");
          const response = await fetch(previewFile.file_url);
          if (!response.ok) throw new Error("Failed to fetch document");
          const arrayBuffer = await response.arrayBuffer();
          const result = await mammoth.convertToHtml({ arrayBuffer });
          if (cancelled) return;
          setPreviewDocHtml(result.value || "");
          setPreviewLoading(false);
          return;
        }

        if (isSheet) {
          const XLSX = await import("xlsx");
          const response = await fetch(previewFile.file_url);
          if (!response.ok) throw new Error("Failed to fetch spreadsheet");
          const arrayBuffer = await response.arrayBuffer();
          const workbook = XLSX.read(arrayBuffer, { type: "array" });
          const firstSheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[firstSheetName];
          const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false });
          if (cancelled) return;
          setPreviewSheetName(firstSheetName || "");
          setPreviewSheetRows(rows || []);
          setPreviewLoading(false);
        }
      } catch (error) {
        console.error("Preview parse error:", error);
        if (!cancelled) {
          setPreviewLoading(false);
          setPreviewError(true);
        }
      }
    };

    if (isDoc || isSheet) {
      loadStructuredPreview();
    }

    return () => {
      cancelled = true;
    };
  }, [previewFile]);

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setUploading(true);
    try {
      const fileUrl = await uploadToCloudinary(file);

      const { data, error } = await supabase
        .from("project_files")
        .insert({
          project_id: project.id,
          file_name: file.name,
          file_url: fileUrl,
          file_type: file.type,
        })
        .select();

      if (error) throw error;
      setFiles((currentFiles) => [data[0], ...currentFiles]);
    } catch (error) {
      console.error("Upload error:", error);
      await notifyError("Upload failed", error.message || "Unknown error");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const handleReplaceFile = async (fileId, nextFile) => {
    if (!nextFile) return;

    setUploading(true);
    try {
      const fileUrl = await uploadToCloudinary(nextFile);
      const { data, error } = await supabase
        .from("project_files")
        .update({
          file_name: nextFile.name,
          file_url: fileUrl,
          file_type: nextFile.type,
          uploaded_at: new Date().toISOString(),
        })
        .eq("id", fileId)
        .select()
        .single();

      if (error) throw error;

      setFiles((currentFiles) =>
        currentFiles.map((file) => (file.id === fileId ? data : file)),
      );
      setPreviewFile((currentPreview) =>
        currentPreview?.id === fileId ? data : currentPreview,
      );
    } catch (error) {
      console.error("Replace file error:", error);
      await notifyError("Replace file failed", error.message || "Unknown error");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteFile = async (fileId) => {
    const confirmed = await notifyConfirm({
      title: "Delete this file?",
      text: "This action cannot be undone.",
      confirmText: "Delete",
    });
    if (!confirmed) return;

    try {
      const { error } = await supabase.from("project_files").delete().eq("id", fileId);
      if (error) throw error;

      setFiles((currentFiles) => currentFiles.filter((file) => file.id !== fileId));
      setPreviewFile((currentPreview) =>
        currentPreview?.id === fileId ? null : currentPreview,
      );
    } catch (error) {
      console.error("Delete file error:", error);
      await notifyError("Delete file failed", error.message || "Unknown error");
    }
  };

  const getFileMeta = (fileName, fileType) => {
    const ext = fileName.split(".").pop().toLowerCase();

    if (
      fileType?.includes("image") ||
      ["jpg", "jpeg", "png", "gif", "webp"].includes(ext)
    ) {
      return {
        icon: FileImage,
        accent: "green",
        category: "Gambar",
        iconLabel: "IMG",
      };
    }
    if (fileType?.includes("pdf") || ext === "pdf") {
      return {
        icon: FileText,
        accent: "red",
        category: "PDF",
        iconLabel: "PDF",
      };
    }
    if (["xls", "xlsx", "csv"].includes(ext)) {
      return {
        icon: FileSpreadsheet,
        accent: "green",
        category: "Excel",
        iconLabel: "XLS",
      };
    }
    if (["skp", "dae", "obj", "fbx", "3ds"].includes(ext)) {
      return {
        icon: Box,
        accent: "blue",
        category: "3D Model",
        iconLabel: "3D",
      };
    }
    if (["doc", "docx"].includes(ext)) {
      return {
        icon: FileType,
        accent: "blue",
        category: "Dokumen",
        iconLabel: "DOC",
      };
    }
    return {
      icon: File,
      accent: "slate",
      category: "Dokumen",
      iconLabel: "FILE",
    };
  };

  const groupedFiles = useMemo(() => {
    const groups = {};

    files.forEach((file) => {
      const meta = getFileMeta(file.file_name, file.file_type);
      if (!groups[meta.category]) {
        groups[meta.category] = {
          label: meta.category,
          accent: meta.accent,
          icon: meta.icon,
          items: [],
        };
      }

      groups[meta.category].items.push(file);
    });

    return Object.values(groups);
  }, [files]);

  const infoRows = project
    ? [
        ["Company", project.company],
        ["Project", project.project_name],
        ["Description", project.description || "No description"],
        ["Request Date", formatDisplayDate(project.request_date)],
        ["Initial Date", formatDisplayDate(project.initial_date)],
      ]
    : emptyInfo;

  return (
    <>
      <section className="card info-card">
        <h2 className="card-heading">General Information</h2>
        <div className="info-table">
          {infoRows.map(([label, value]) => (
            <div key={label} className="info-row">
              <div className="info-label">{label}</div>
              <div className="info-separator">:</div>
              <div className="info-value">{value}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="card info-card">
        <div className="file-card-head">
          <h2 className="card-heading">File Project</h2>
          <label
            className={`btn btn-outline btn-sm upload-inline ${!project ? "disabled-like" : ""}`}
          >
            Upload File
            <input
              type="file"
              style={{ display: "none" }}
              onChange={handleFileUpload}
              disabled={uploading || !project}
              accept=".pdf,.jpg,.jpeg,.png,.xls,.xlsx,.doc,.docx,.skp,.dae,.obj"
            />
          </label>
        </div>

        {!project ? (
          <div className="empty-file-panel">
            Pilih project untuk melihat dan upload file.
          </div>
        ) : groupedFiles.length === 0 ? (
          <label className="empty-file-dropzone">
            <span className="empty-file-plus">+</span>
            <span>Click to upload file</span>
            <input
              type="file"
              style={{ display: "none" }}
              onChange={handleFileUpload}
              disabled={uploading}
              accept=".pdf,.jpg,.jpeg,.png,.xls,.xlsx,.doc,.docx,.skp,.dae,.obj"
            />
          </label>
        ) : (
          <div className="file-summary-grid">
            {groupedFiles.map((group) => {
              const IconComponent = group.icon;
              return (
                <button
                  key={group.label}
                  type="button"
                  className="file-summary-card"
                  onClick={() => setPreviewFile(group.items[0])}
                >
                  <div className={`file-summary-icon ${group.accent}`}>
                    <IconComponent size={26} strokeWidth={2} />
                  </div>
                  <div className="file-summary-copy">
                    <div className="file-summary-title">{group.label}</div>
                    <div className="file-summary-count">
                      {group.items.length} files
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {uploading && (
          <span className="loading loading-spinner loading-sm ml-2"></span>
        )}
      </section>

      <section className="card progress-card">
        <div className="progress-card-head">
          <div>
            <div className="progress-eyebrow">Project Progress</div>
            <h2 className="progress-title">Completion Overview</h2>
          </div>
          <div className="progress-pill">
            {progressSummary?.totalStages || 0} tracked stages
          </div>
        </div>

        <div className="progress-hero">
          <div className="progress-score-wrap">
            <div className="progress-score">{progressSummary?.progress || 0}%</div>
            <div className="progress-score-copy">Project Completion</div>
            <div className="progress-score-note">
              {progressSummary?.completedEquivalent || 0} of {progressSummary?.totalStages || 0} stage-equivalents progressed
            </div>
          </div>

          <div className="progress-breakdown-wrap">
            <div className="progress-stack">
              {(progressSummary?.stats || []).map((stat) => (
                <div
                  key={stat.status}
                  className={`progress-stack-segment ${stat.tone}`}
                  style={{ width: `${stat.percent}%` }}
                  title={`${stat.label}: ${stat.count} stages`}
                />
              ))}
            </div>

            <div className="progress-stats-grid">
              {(progressSummary?.stats || Object.entries(statusDisplay).map(([status, config]) => ({
                status,
                ...config,
                count: 0,
                percent: 0,
              }))).map((stat) => (
                <div key={stat.status} className={`progress-stat-card ${stat.tone}`}>
                  <div className="progress-stat-top">
                    <span className={`progress-stat-dot ${stat.tone}`} />
                    <span className="progress-stat-label">{stat.label}</span>
                  </div>
                  <div className="progress-stat-value">{stat.count}</div>
                  <div className="progress-stat-meta">{stat.percent}% of all stages</div>
                </div>
              ))}
            </div>

            <div className="progress-alert-row">
              <div className="progress-alert-card">
                <span className="progress-alert-label">Missing Upload</span>
                <span className="progress-alert-value">{progressSummary?.missingStages || 0} stages</span>
              </div>
              <div className="progress-alert-card">
                <span className="progress-alert-label">Overdue Items</span>
                <span className="progress-alert-value">{progressSummary?.overdueItems || 0} products</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {previewFile && (
        <div className="modal modal-open">
          <button
            type="button"
            className="modal-close-external modal-close-preview"
            onClick={() => setPreviewFile(null)}
            aria-label="Close modal"
          >
            <X size={28} />
          </button>
          <div
            className="modal-box"
            style={{
              maxWidth: "90vw",
              maxHeight: "90vh",
              padding: "0",
              overflow: "hidden",
            }}
          >
            <div style={{ display: "flex", height: "85vh" }}>
              <div
                style={{
                  flex: "0 0 70%",
                  padding: "2rem",
                  background: "#f9fafb",
                  display: "flex",
                  flexDirection: "column",
                  overflow: "auto",
                }}
              >
                <h3
                  style={{
                    fontWeight: "bold",
                    fontSize: "1.25rem",
                    marginBottom: "1.5rem",
                    color: "var(--dark)",
                  }}
                >
                  {previewFile.file_name}
                </h3>

                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {previewFile.file_type?.includes("image") ? (
                    <div className="preview-stage">
                      {previewLoading && (
                        <div className="preview-loading">
                          <span className="loading loading-spinner loading-lg"></span>
                          <span className="preview-loading-text">
                            Loading preview...
                          </span>
                        </div>
                      )}
                      {previewError ? (
                        <div className="preview-fallback">
                          <p className="preview-fallback-title">
                            Image preview failed
                          </p>
                          <a
                            href={previewFile.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-outline"
                          >
                            Open File
                          </a>
                        </div>
                      ) : (
                        <img
                          src={previewFile.file_url}
                          alt={previewFile.file_name}
                          onLoad={() => setPreviewLoading(false)}
                          onError={() => {
                            setPreviewLoading(false);
                            setPreviewError(true);
                          }}
                          style={{
                            maxWidth: "100%",
                            maxHeight: "100%",
                            objectFit: "contain",
                            opacity: previewLoading ? 0 : 1,
                            transition: "opacity 0.2s ease",
                          }}
                        />
                      )}
                    </div>
                  ) : previewFile.file_type?.includes("pdf") ? (
                    <div className="preview-stage">
                      {previewLoading && (
                        <div className="preview-loading">
                          <span className="loading loading-spinner loading-lg"></span>
                          <span className="preview-loading-text">
                            Loading PDF preview...
                          </span>
                        </div>
                      )}
                      {previewError ? (
                        <div className="preview-fallback">
                          <p className="preview-fallback-title">
                            PDF preview failed
                          </p>
                          <a
                            href={previewFile.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-outline"
                          >
                            Open File
                          </a>
                        </div>
                      ) : (
                        <iframe
                          src={previewFile.file_url}
                          onLoad={() => setPreviewLoading(false)}
                          onError={() => {
                            setPreviewLoading(false);
                            setPreviewError(true);
                          }}
                          style={{
                            width: "100%",
                            height: "100%",
                            border: "none",
                            opacity: previewLoading ? 0 : 1,
                            transition: "opacity 0.2s ease",
                          }}
                        />
                      )}
                    </div>
                  ) : /\.(doc|docx)$/i.test(previewFile.file_name) ? (
                    <div className="preview-stage">
                      {previewLoading && (
                        <div className="preview-loading">
                          <span className="loading loading-spinner loading-lg"></span>
                          <span className="preview-loading-text">
                            Loading document preview...
                          </span>
                        </div>
                      )}
                      {previewError ? (
                        <div className="preview-fallback">
                          <p className="preview-fallback-title">
                            Document preview failed
                          </p>
                          <a
                            href={previewFile.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-outline"
                          >
                            Open File
                          </a>
                        </div>
                      ) : (
                        <div
                          className="approval-doc-preview"
                          style={{ opacity: previewLoading ? 0 : 1 }}
                          dangerouslySetInnerHTML={{
                            __html:
                              previewDocHtml ||
                              '<p class="approval-doc-empty">No document content.</p>',
                          }}
                        />
                      )}
                    </div>
                  ) : /\.(xls|xlsx|csv)$/i.test(previewFile.file_name) ? (
                    <div className="preview-stage">
                      {previewLoading && (
                        <div className="preview-loading">
                          <span className="loading loading-spinner loading-lg"></span>
                          <span className="preview-loading-text">
                            Loading spreadsheet preview...
                          </span>
                        </div>
                      )}
                      {previewError ? (
                        <div className="preview-fallback">
                          <p className="preview-fallback-title">
                            Spreadsheet preview failed
                          </p>
                          <a
                            href={previewFile.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-outline"
                          >
                            Open File
                          </a>
                        </div>
                      ) : (
                        <div
                          className="approval-sheet-preview"
                          style={{ width: "100%", maxHeight: "100%", opacity: previewLoading ? 0 : 1 }}
                        >
                          <div className="approval-sheet-title">
                            {previewSheetName || "Sheet 1"}
                          </div>
                          <div className="approval-sheet-scroll">
                            <table className="approval-sheet-table">
                              <tbody>
                                {previewSheetRows.map((row, rowIndex) => (
                                  <tr key={`sheet-row-${rowIndex}`}>
                                    {row.map((cell, cellIndex) => (
                                      <td key={`sheet-cell-${rowIndex}-${cellIndex}`}>
                                        {cell === null || cell === undefined || cell === ""
                                          ? "-"
                                          : String(cell)}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : previewFile.file_name.match(
                      /\.(skp|dae|obj|fbx|3ds)$/i,
                    ) ? (
                    <div style={{ textAlign: "center", padding: "2rem" }}>
                      <div
                        style={{
                          width: "120px",
                          height: "120px",
                          margin: "0 auto 1.5rem",
                          borderRadius: "12px",
                          background: "#1d4ed8",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Box size={64} color="#fff" strokeWidth={2} />
                      </div>
                      <p
                        style={{
                          color: "var(--muted)",
                          marginBottom: "1rem",
                          fontSize: "16px",
                        }}
                      >
                        3D Model Preview
                      </p>
                      <p
                        style={{
                          color: "var(--muted)",
                          fontSize: "14px",
                          marginBottom: "1.5rem",
                        }}
                      >
                        {previewFile.file_name}
                      </p>
                      <a
                        href={previewFile.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-outline"
                      >
                        Download to View
                      </a>
                    </div>
                  ) : (
                    <div style={{ textAlign: "center", padding: "2rem" }}>
                      <div
                        style={{
                          width: "120px",
                          height: "120px",
                          margin: "0 auto 1.5rem",
                          borderRadius: "12px",
                          background: "#64748b",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <File size={64} color="#fff" strokeWidth={2} />
                      </div>
                      <p
                        style={{
                          color: "var(--muted)",
                          marginBottom: "1rem",
                          fontSize: "16px",
                        }}
                      >
                        Preview not available
                      </p>
                      <a
                        href={previewFile.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-outline"
                      >
                        Open File
                      </a>
                    </div>
                  )}
                </div>
              </div>

              <div
                style={{
                  flex: "0 0 30%",
                  padding: "2rem",
                  background: "#fff",
                  borderLeft: "1px solid #e5e7eb",
                  overflowY: "auto",
                }}
              >
                <h4
                  style={{
                    fontWeight: "bold",
                    fontSize: "1rem",
                    marginBottom: "1rem",
                    color: "var(--dark)",
                  }}
                >
                  All Files
                </h4>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                  }}
                >
                  {files.map((file) => {
                    const meta = getFileMeta(file.file_name, file.file_type);
                    const IconComponent = meta.icon;
                    const isActive = previewFile.id === file.id;
                    return (
                      <div
                        key={file.id}
                        onClick={() => setPreviewFile(file)}
                        style={{
                          border: isActive
                            ? "2px solid #1d4ed8"
                            : "1px solid #e5e7eb",
                          borderRadius: "10px",
                          padding: "10px",
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          cursor: "pointer",
                          transition: "all 0.2s ease",
                          background: isActive ? "#eff6ff" : "#fff",
                        }}
                      >
                        <div className={`file-summary-icon ${meta.accent}`}>
                          <IconComponent size={18} strokeWidth={2} />
                        </div>
                        <div style={{ flex: 1, overflow: "hidden" }}>
                          <div
                            style={{
                              fontWeight: isActive ? 700 : 600,
                              fontSize: "12px",
                              color: isActive ? "#1d4ed8" : "var(--dark)",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {file.file_name}
                          </div>
                        </div>
                        <div className="file-item-actions">
                          <label className="btn btn-xs btn-outline approval-file-mini-action">
                            Ganti
                            <input
                              type="file"
                              style={{ display: "none" }}
                              onChange={(event) => {
                                handleReplaceFile(file.id, event.target.files?.[0]);
                                event.target.value = "";
                              }}
                              disabled={uploading}
                              accept=".pdf,.jpg,.jpeg,.png,.xls,.xlsx,.doc,.docx,.skp,.dae,.obj,.csv,.glb,.gltf"
                            />
                          </label>
                          <button
                            type="button"
                            className="btn btn-xs btn-outline approval-file-mini-action danger"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleDeleteFile(file.id);
                            }}
                            disabled={uploading}
                          >
                            Hapus
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div
              className="modal-action"
              style={{ padding: "1.5rem", borderTop: "1px solid #e5e7eb" }}
            >
              <button
                className="btn btn-ghost"
                onClick={() => setPreviewFile(null)}
              >
                Close
              </button>
              <a
                href={previewFile.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-outline"
              >
                Open in New Tab
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
