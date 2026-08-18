"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useLanguage } from "@/components/language-provider";
import { message } from "@/lib/i18n";
import styles from "./workflow-guide.module.css";
import {
  WORKFLOWS,
  workflowImageForLocale,
  type WorkflowDefinition,
  type WorkflowId
} from "@/lib/ui/workflows";

type WorkflowGuideButtonProps = {
  workflows: WorkflowDefinition[];
};

type WorkflowGalleryProps = {
  workflows?: WorkflowDefinition[];
};

function WorkflowPreview({
  workflow,
  mode
}: {
  workflow: WorkflowDefinition;
  mode: "card" | "modal";
}) {
  const { locale } = useLanguage();
  const imageSrc = workflowImageForLocale(workflow, locale);

  return (
    <article className={styles.preview} data-i18n-rendered="true">
      <div className={styles.previewHead}>
        <div>
          <h3>{workflow.title[locale]}</h3>
          <p>{workflow.summary[locale]}</p>
        </div>
        <span className={styles.localePill}>{locale.toUpperCase()}</span>
      </div>
      <div className={styles.imageFrame}>
        <Image src={imageSrc} alt={workflow.title[locale]} width={1440} height={980} unoptimized />
      </div>
    </article>
  );
}

export function WorkflowGuideButton({ workflows }: WorkflowGuideButtonProps) {
  const { locale } = useLanguage();
  const [activeWorkflowId, setActiveWorkflowId] = useState<WorkflowId | null>(null);
  const selectedWorkflow = useMemo(
    () => workflows.find((workflow) => workflow.id === activeWorkflowId) ?? workflows[0] ?? null,
    [activeWorkflowId, workflows]
  );

  if (workflows.length === 0) {
    return null;
  }

  return (
    <>
      <div className={styles.buttonGroup} data-i18n-rendered="true">
        {workflows.map((workflow) => (
          <button
            key={workflow.id}
            type="button"
            className={`ghost-btn ${styles.guideButton}`}
            onClick={() => setActiveWorkflowId(workflow.id)}
          >
            {message(locale, "workflow.open")}
          </button>
        ))}
      </div>

      {activeWorkflowId && selectedWorkflow ? (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label={message(locale, "workflow.guide")}
          data-i18n-rendered="true"
        >
          <div className={`modal-card ${styles.modalCard}`}>
            <div className="title-row po-modal-head">
              <div>
                <h4>{selectedWorkflow.title[locale]}</h4>
                <p className="po-modal-subtitle">{message(locale, "workflow.guide")}</p>
              </div>
              <button
                type="button"
                className="ghost-btn po-modal-close"
                aria-label={message(locale, "common.close")}
                onClick={() => setActiveWorkflowId(null)}
              >
                x
              </button>
            </div>
            <div className={styles.modalBody}>
              <WorkflowPreview workflow={selectedWorkflow} mode="modal" />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function WorkflowGallery({ workflows = WORKFLOWS }: WorkflowGalleryProps) {
  return (
    <section className={`card ${styles.galleryCard}`}>
      <div className={styles.galleryGrid}>
        {workflows.map((workflow) => (
          <WorkflowPreview key={workflow.id} workflow={workflow} mode="card" />
        ))}
      </div>
    </section>
  );
}
