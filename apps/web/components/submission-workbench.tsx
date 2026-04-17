"use client";

import { useState, useTransition } from "react";

import type { SubmissionRecord } from "@/lib/types";

const emptyObservation = {
  observedAt: "",
  scientificName: "",
  commonName: "",
  locality: "",
  latitude: "",
  longitude: "",
  elevationBand: "media",
  notes: ""
};

const emptyCorrection = {
  targetEntityType: "species",
  targetEntityRef: "",
  fieldPath: "",
  currentValue: "",
  proposedValue: "",
  rationale: ""
};

const emptySpeciesEditorial = {
  targetEntityRef: "",
  summary: "",
  status: "",
  endemism: "",
  notes: ""
};

const emptyAreaEditorial = {
  targetEntityRef: "",
  summary: "",
  storyLabel: "",
  notes: ""
};

const hashFile = async (file: File) => {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
};

export function SubmissionWorkbench({
  initialSubmissions
}: {
  initialSubmissions: SubmissionRecord[];
}) {
  const [submissionType, setSubmissionType] =
    useState<SubmissionRecord["submissionType"]>("observation_create");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [submissions, setSubmissions] = useState(initialSubmissions);
  const [isPending, startTransition] = useTransition();
  const [observation, setObservation] = useState(emptyObservation);
  const [correction, setCorrection] = useState(emptyCorrection);
  const [speciesEditorial, setSpeciesEditorial] = useState(emptySpeciesEditorial);
  const [areaEditorial, setAreaEditorial] = useState(emptyAreaEditorial);
  const [files, setFiles] = useState<FileList | null>(null);

  const buildRequestBody = () => {
    if (submissionType === "observation_create") {
      return {
        title,
        schemaVersion: 1,
        submissionType,
        targetEntityType: "observation",
        targetEntityRef: observation.scientificName,
        payload: {
          observedAt: observation.observedAt,
          scientificName: observation.scientificName,
          commonName: observation.commonName,
          locality: observation.locality,
          latitude: Number(observation.latitude),
          longitude: Number(observation.longitude),
          elevationBand: observation.elevationBand,
          notes: observation.notes || undefined
        }
      };
    }

    if (submissionType === "data_correction") {
      return {
        title,
        schemaVersion: 1,
        submissionType,
        targetEntityType: correction.targetEntityType,
        targetEntityRef: correction.targetEntityRef,
        payload: {
          targetEntityType: correction.targetEntityType,
          targetEntityRef: correction.targetEntityRef,
          fieldPath: correction.fieldPath,
          currentValue: correction.currentValue,
          proposedValue: correction.proposedValue,
          rationale: correction.rationale
        }
      };
    }

    if (submissionType === "species_editorial") {
      return {
        title,
        schemaVersion: 1,
        submissionType,
        targetEntityType: "species",
        targetEntityRef: speciesEditorial.targetEntityRef,
        payload: {
          targetEntityRef: speciesEditorial.targetEntityRef,
          summary: speciesEditorial.summary,
          status: speciesEditorial.status,
          endemism: speciesEditorial.endemism,
          notes: speciesEditorial.notes || undefined
        }
      };
    }

    return {
      title,
      schemaVersion: 1,
      submissionType,
      targetEntityType: "area",
      targetEntityRef: areaEditorial.targetEntityRef,
      payload: {
        targetEntityRef: areaEditorial.targetEntityRef,
        summary: areaEditorial.summary,
        storyLabel: areaEditorial.storyLabel,
        notes: areaEditorial.notes || undefined
      }
    };
  };

  const uploadFiles = async (submissionId: string) => {
    if (!files || files.length === 0) {
      return;
    }

    for (const file of Array.from(files)) {
      const checksumSha256 = await hashFile(file);
      const presignResponse = await fetch(`/api/submissions/${submissionId}/media/presign`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type,
          byteSize: file.size,
          checksumSha256
        })
      });

      if (!presignResponse.ok) {
        throw new Error("No se pudo preparar la carga del archivo.");
      }

      const upload = (await presignResponse.json()) as {
        uploadUrl: string;
        objectKey: string;
        headers: Record<string, string>;
      };

      const putResponse = await fetch(upload.uploadUrl, {
        method: "PUT",
        headers: upload.headers,
        body: file
      });

      if (!putResponse.ok) {
        throw new Error("La carga del archivo falló.");
      }

      const finalizeResponse = await fetch(`/api/submissions/${submissionId}/media/finalize`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          objectKey: upload.objectKey,
          fileName: file.name,
          contentType: file.type,
          byteSize: file.size,
          checksumSha256,
          metadata: {}
        })
      });

      if (!finalizeResponse.ok) {
        throw new Error("No se pudo finalizar el archivo cargado.");
      }
    }
  };

  const refreshSubmissions = async () => {
    const response = await fetch("/api/submissions/mine");
    if (!response.ok) {
      return;
    }
    const payload = (await response.json()) as { submissions: SubmissionRecord[] };
    setSubmissions(payload.submissions);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);

    startTransition(() => {
      void (async () => {
        try {
          const createResponse = await fetch("/api/submissions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify(buildRequestBody())
          });

          if (!createResponse.ok) {
            throw new Error("No se pudo crear el borrador.");
          }

          const created = (await createResponse.json()) as { submissionId: string };
          await uploadFiles(created.submissionId);

          const submitResponse = await fetch(`/api/submissions/${created.submissionId}/submit`, {
            method: "POST"
          });

          if (!submitResponse.ok) {
            throw new Error("No se pudo enviar la contribución a revisión.");
          }

          await refreshSubmissions();
          setMessage("Contribución enviada a revisión.");
          setTitle("");
          setFiles(null);
          setObservation(emptyObservation);
          setCorrection(emptyCorrection);
          setSpeciesEditorial(emptySpeciesEditorial);
          setAreaEditorial(emptyAreaEditorial);
        } catch (error) {
          setMessage(error instanceof Error ? error.message : "Ocurrió un error.");
        }
      })();
    });
  };

  return (
    <div className="grid-two">
      <section className="detail-panel">
        <p className="eyebrow">Nueva contribución</p>
        <h2>Observaciones, correcciones y sugerencias editoriales</h2>
        <form className="search-form" onSubmit={handleSubmit}>
          <input
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Título breve"
            required
            value={title}
          />
          <select
            onChange={(event) =>
              setSubmissionType(event.target.value as SubmissionRecord["submissionType"])
            }
            value={submissionType}
          >
            <option value="observation_create">Nueva observación</option>
            <option value="data_correction">Corrección de datos</option>
            <option value="species_editorial">Sugerencia editorial de especie</option>
            <option value="area_editorial">Sugerencia editorial de área</option>
          </select>

          {submissionType === "observation_create" ? (
            <>
              <input
                onChange={(event) =>
                  setObservation((current) => ({ ...current, observedAt: event.target.value }))
                }
                placeholder="Fecha observada (YYYY-MM-DD)"
                required
                value={observation.observedAt}
              />
              <input
                onChange={(event) =>
                  setObservation((current) => ({
                    ...current,
                    scientificName: event.target.value
                  }))
                }
                placeholder="Nombre científico"
                required
                value={observation.scientificName}
              />
              <input
                onChange={(event) =>
                  setObservation((current) => ({ ...current, commonName: event.target.value }))
                }
                placeholder="Nombre común"
                required
                value={observation.commonName}
              />
              <input
                onChange={(event) =>
                  setObservation((current) => ({ ...current, locality: event.target.value }))
                }
                placeholder="Localidad"
                required
                value={observation.locality}
              />
              <input
                onChange={(event) =>
                  setObservation((current) => ({ ...current, latitude: event.target.value }))
                }
                placeholder="Latitud"
                required
                type="number"
                value={observation.latitude}
              />
              <input
                onChange={(event) =>
                  setObservation((current) => ({ ...current, longitude: event.target.value }))
                }
                placeholder="Longitud"
                required
                type="number"
                value={observation.longitude}
              />
              <select
                onChange={(event) =>
                  setObservation((current) => ({
                    ...current,
                    elevationBand: event.target.value
                  }))
                }
                value={observation.elevationBand}
              >
                <option value="baja">Baja</option>
                <option value="media">Media</option>
                <option value="alta">Alta</option>
              </select>
              <textarea
                onChange={(event) =>
                  setObservation((current) => ({ ...current, notes: event.target.value }))
                }
                placeholder="Notas"
                value={observation.notes}
              />
            </>
          ) : null}

          {submissionType === "data_correction" ? (
            <>
              <select
                onChange={(event) =>
                  setCorrection((current) => ({
                    ...current,
                    targetEntityType: event.target.value
                  }))
                }
                value={correction.targetEntityType}
              >
                <option value="species">Especie</option>
                <option value="area">Área</option>
                <option value="observation">Observación</option>
                <option value="dataset">Dataset</option>
              </select>
              <input
                onChange={(event) =>
                  setCorrection((current) => ({
                    ...current,
                    targetEntityRef: event.target.value
                  }))
                }
                placeholder="ID o slug objetivo"
                required
                value={correction.targetEntityRef}
              />
              <input
                onChange={(event) =>
                  setCorrection((current) => ({ ...current, fieldPath: event.target.value }))
                }
                placeholder="Campo"
                required
                value={correction.fieldPath}
              />
              <textarea
                onChange={(event) =>
                  setCorrection((current) => ({
                    ...current,
                    currentValue: event.target.value
                  }))
                }
                placeholder="Valor actual"
                value={correction.currentValue}
              />
              <textarea
                onChange={(event) =>
                  setCorrection((current) => ({
                    ...current,
                    proposedValue: event.target.value
                  }))
                }
                placeholder="Valor propuesto"
                value={correction.proposedValue}
              />
              <textarea
                onChange={(event) =>
                  setCorrection((current) => ({ ...current, rationale: event.target.value }))
                }
                placeholder="Justificación"
                required
                value={correction.rationale}
              />
            </>
          ) : null}

          {submissionType === "species_editorial" ? (
            <>
              <input
                onChange={(event) =>
                  setSpeciesEditorial((current) => ({
                    ...current,
                    targetEntityRef: event.target.value
                  }))
                }
                placeholder="Slug de especie"
                required
                value={speciesEditorial.targetEntityRef}
              />
              <textarea
                onChange={(event) =>
                  setSpeciesEditorial((current) => ({
                    ...current,
                    summary: event.target.value
                  }))
                }
                placeholder="Resumen propuesto"
                required
                value={speciesEditorial.summary}
              />
              <input
                onChange={(event) =>
                  setSpeciesEditorial((current) => ({ ...current, status: event.target.value }))
                }
                placeholder="Estado"
                required
                value={speciesEditorial.status}
              />
              <input
                onChange={(event) =>
                  setSpeciesEditorial((current) => ({
                    ...current,
                    endemism: event.target.value
                  }))
                }
                placeholder="Endemismo"
                required
                value={speciesEditorial.endemism}
              />
              <textarea
                onChange={(event) =>
                  setSpeciesEditorial((current) => ({ ...current, notes: event.target.value }))
                }
                placeholder="Notas"
                value={speciesEditorial.notes}
              />
            </>
          ) : null}

          {submissionType === "area_editorial" ? (
            <>
              <input
                onChange={(event) =>
                  setAreaEditorial((current) => ({
                    ...current,
                    targetEntityRef: event.target.value
                  }))
                }
                placeholder="Slug de área"
                required
                value={areaEditorial.targetEntityRef}
              />
              <textarea
                onChange={(event) =>
                  setAreaEditorial((current) => ({
                    ...current,
                    summary: event.target.value
                  }))
                }
                placeholder="Resumen propuesto"
                required
                value={areaEditorial.summary}
              />
              <input
                onChange={(event) =>
                  setAreaEditorial((current) => ({
                    ...current,
                    storyLabel: event.target.value
                  }))
                }
                placeholder="Story label"
                required
                value={areaEditorial.storyLabel}
              />
              <textarea
                onChange={(event) =>
                  setAreaEditorial((current) => ({ ...current, notes: event.target.value }))
                }
                placeholder="Notas"
                value={areaEditorial.notes}
              />
            </>
          ) : null}

          <label>
            Archivos adjuntos
            <input
              multiple
              onChange={(event) => setFiles(event.target.files)}
              type="file"
            />
          </label>

          <button disabled={isPending} type="submit">
            {isPending ? "Enviando..." : "Enviar a revisión"}
          </button>
        </form>
        {message ? <p>{message}</p> : null}
      </section>

      <aside className="detail-panel">
        <p className="eyebrow">Mis envíos</p>
        <h2>Historial reciente</h2>
        <div className="grid-two">
          {submissions.map((submission) => (
            <article className="entity-card" key={submission.id}>
              <p className="entity-card-eyebrow">{submission.submissionType}</p>
              <h3>{submission.title}</h3>
              <p>Estado: {submission.status}</p>
              <p>Adjuntos: {submission.media.length}</p>
              <p>Actualizado: {new Date(submission.updatedAt).toLocaleString()}</p>
            </article>
          ))}
        </div>
      </aside>
    </div>
  );
}
