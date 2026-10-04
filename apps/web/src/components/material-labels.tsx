"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { materialLabelPayload, supportsCode128 } from "@olaph/core";
import type { IScannerControls } from "@zxing/browser";

export type LabelMaterial = {
  id: string;
  code: string;
  name: string;
  unit: string;
  quantity: string;
};

export function MaterialLabel({
  workspace,
  material,
  onClose,
}: {
  workspace: string;
  material: LabelMaterial;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [format, setFormat] = useState<"qrcode" | "code128">("qrcode");
  const [image, setImage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  useEffect(() => {
    let active = true;
    setImage("");
    setError("");
    void import("@bwip-js/browser")
      .then(({ qrcode, code128 }) => {
        const canvas = document.createElement("canvas");
        const render = format === "qrcode" ? qrcode : code128;
        render(canvas, {
          bcid: format,
          text:
            format === "qrcode"
              ? materialLabelPayload(workspace, material.id)
              : material.code,
          scale: 3,
          padding: 12,
          backgroundcolor: "ffffff",
          ...(format === "code128"
            ? { height: 16, includetext: true, textxalign: "center" as const }
            : {}),
        });
        if (active) setImage(canvas.toDataURL("image/png"));
      })
      .catch(() => {
        if (active) setError("Etiket oluşturulamadı. Yeniden açıp deneyin.");
      });
    return () => {
      active = false;
    };
  }, [format, material.id, material.code, workspace]);
  return (
    <dialog
      ref={dialog}
      className="portal-dialog portal-label-dialog"
      onCancel={onClose}
    >
      <div className="portal-title">
        <h2>Malzeme etiketi</h2>
        <button type="button" aria-label="Kapat" onClick={onClose}>
          ×
        </button>
      </div>
      <label>
        Etiket türü
        <select
          value={format}
          onChange={(event) => setFormat(event.target.value as typeof format)}
        >
          <option value="qrcode">QR · firmaya bağlı kayıt</option>
          <option value="code128" disabled={!supportsCode128(material.code)}>
            Code 128 · malzeme kodu
          </option>
        </select>
      </label>
      <p className="portal-hint">
        QR, kod değişse de aynı malzemeyi bulur. Code 128, seçili firmada
        malzeme kodunu arar. Türkçe karakterli veya 64 karakterden uzun kodlar
        için QR kullanın.
      </p>
      <div className="portal-label-sheet">
        <span className="eyebrow">OLAPH · MALZEME</span>
        {image ? (
          <img
            src={image}
            alt={`${material.code} ${format === "qrcode" ? "QR" : "Code 128"} etiketi`}
          />
        ) : (
          <p role="status">Etiket hazırlanıyor…</p>
        )}
        <strong>{material.code}</strong>
        <span>{material.name}</span>
        <small>Stok birimi: {material.unit}</small>
      </div>
      {error && (
        <p role="alert" className="portal-alert error">
          {error}
        </p>
      )}
      <div className="portal-label-actions">
        {image && (
          <a
            className="button dark"
            href={image}
            download={`olaph-${material.id}-${format}.png`}
          >
            PNG indir
          </a>
        )}
        <button
          type="button"
          className="button light"
          disabled={!image}
          onClick={() => window.print()}
        >
          Etiketi yazdır
        </button>
      </div>
    </dialog>
  );
}

export function MaterialScanner({
  resolve,
  onClose,
  onStock,
}: {
  resolve: (value: string) => Promise<LabelMaterial>;
  onClose: () => void;
  onStock?: (material: LabelMaterial) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    video = useRef<HTMLVideoElement>(null);
  const controls = useRef<IScannerControls | null>(null),
    stream = useRef<MediaStream | null>(null);
  const generation = useRef(0),
    alive = useRef(true),
    resolving = useRef(false);
  const [value, setValue] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [camera, setCamera] = useState(false),
    [found, setFound] = useState<LabelMaterial | null>(null);
  function stopCamera() {
    generation.current++;
    controls.current?.stop();
    controls.current = null;
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    if (alive.current) setCamera(false);
  }
  useEffect(() => {
    alive.current = true;
    dialog.current?.showModal();
    return () => {
      alive.current = false;
      stopCamera();
    };
  }, []);
  async function lookup(input: string) {
    if (resolving.current || !alive.current) return;
    resolving.current = true;
    stopCamera();
    setBusy(true);
    setError("");
    setFound(null);
    setValue(input);
    try {
      const material = await resolve(input);
      if (alive.current) setFound(material);
    } catch (failure) {
      if (alive.current) setError((failure as Error).message);
    } finally {
      resolving.current = false;
      if (alive.current) setBusy(false);
    }
  }
  async function startCamera() {
    stopCamera();
    setError("");
    setFound(null);
    const current = generation.current;
    setCamera(true);
    try {
      if (!navigator.mediaDevices?.getUserMedia)
        throw Error("Camera unavailable");
      const media = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      if (!alive.current || current !== generation.current) {
        media.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.current = media;
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      if (!alive.current || current !== generation.current || !video.current) {
        media.getTracks().forEach((track) => track.stop());
        return;
      }
      const scanner = new BrowserMultiFormatReader();
      const scanning = await scanner.decodeFromStream(
        media,
        video.current,
        (result, _failure, handle) => {
          if (result && alive.current && current === generation.current) {
            handle.stop();
            void lookup(result.getText());
          }
        },
      );
      if (!alive.current || current !== generation.current) scanning.stop();
      else controls.current = scanning;
    } catch {
      if (alive.current && current === generation.current) {
        stopCamera();
        setError(
          "Kamera açılamadı. Kamera iznini kontrol edin; kodu yazabilir, USB okuyucu kullanabilir veya etiket görseli seçebilirsiniz.",
        );
      }
    }
  }
  async function readImage(file?: File) {
    if (!file || resolving.current) return;
    stopCamera();
    setError("");
    setFound(null);
    setBusy(true);
    const current = generation.current;
    let url = "";
    try {
      if (
        !/^image\/(png|jpeg|webp)$/.test(file.type) ||
        file.size > 5 * 1024 * 1024
      )
        throw Error("INVALID_IMAGE");
      url = URL.createObjectURL(file);
      const image = new Image();
      image.src = url;
      await image.decode();
      if (image.naturalWidth * image.naturalHeight > 20_000_000)
        throw Error("INVALID_IMAGE");
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      const result =
        await new BrowserMultiFormatReader().decodeFromImageElement(image);
      if (alive.current && current === generation.current)
        await lookup(result.getText());
    } catch {
      if (alive.current && current === generation.current)
        setError(
          "Etiket okunamadı. Net bir PNG, JPEG veya WebP seçin (en fazla 5 MB ve 20 megapiksel).",
        );
    } finally {
      if (url) URL.revokeObjectURL(url);
      if (alive.current) setBusy(false);
    }
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void lookup(value);
  }
  return (
    <dialog
      ref={dialog}
      className="portal-dialog portal-scan-dialog"
      onCancel={onClose}
    >
      <div className="portal-title">
        <h2>Barkod / QR okut</h2>
        <button type="button" aria-label="Kapat" onClick={onClose}>
          ×
        </button>
      </div>
      <p className="portal-hint">
        USB/Bluetooth okuyucuyla kodu okutun veya elle yazın. Arama yalnızca
        seçili firmada yapılır; okutma stok değiştirmez.
      </p>
      <form onSubmit={submit}>
        <label>
          Malzeme kodu veya QR içeriği
          <input
            autoFocus
            value={value}
            onChange={(event) => setValue(event.target.value)}
            maxLength={300}
            required
            autoComplete="off"
          />
        </label>
        <button className="button dark" disabled={busy}>
          Malzemeyi bul
        </button>
      </form>
      <div className="portal-label-actions">
        <button
          type="button"
          className="button light"
          disabled={busy}
          onClick={() => (camera ? stopCamera() : void startCamera())}
        >
          {camera ? "Kamerayı durdur" : "Kamerayla okut"}
        </button>
        <label className="portal-scan-upload">
          Etiket görseli
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={busy}
            onChange={(event) => {
              void readImage(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
        </label>
      </div>
      <video
        ref={video}
        hidden={!camera}
        className="portal-scan-video"
        autoPlay
        muted
        playsInline
        aria-label="Kamera önizlemesi"
      />
      <p className="portal-hint">
        Kamera ve görsel çözümlemesi cihazınızda yapılır; sunucuya yalnızca
        okunan kod gönderilir.
      </p>
      {busy && <p role="status">Etiket kontrol ediliyor…</p>}
      {error && (
        <p role="alert" className="portal-alert error">
          {error}
        </p>
      )}
      {found && (
        <section className="portal-scan-result" aria-label="Bulunan malzeme">
          <h3>{found.name}</h3>
          <p>
            {found.code} · {found.quantity} {found.unit}
          </p>
          {onStock && (
            <button
              type="button"
              className="button dark"
              onClick={() => onStock(found)}
            >
              Stok hareketi oluştur
            </button>
          )}
        </section>
      )}
    </dialog>
  );
}
