// 弹窗: 预览 / 群设置 / 移动 / 上传
import React, { useEffect, useState } from "react";
import {
  Modal, Button, Form, Input, InputNumber, Radio, Space, message, Upload, App, Alert, Spin,
} from "antd";
import {
  DownloadOutlined, InboxOutlined,
} from "@ant-design/icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { API, loadThumb } from "./api";
import { useUI } from "./store";
import { useBridge } from "./bridge";
import { t } from "./i18n";

// ------------------------------------------------------------------
// Preview modal
// ------------------------------------------------------------------
export function PreviewModal() {
  const ctx = useBridge();
  const preview = useUI((s) => s.previewImage);
  const setPreview = useUI((s) => s.setPreview);
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!preview) { setUrl(null); setDownloadUrl(null); return; }
    setLoading(true);
    (async () => {
      const thumb = await loadThumb(preview.group, preview.name, 1024);
      if (thumb) setUrl(thumb);
      // 另存原图链接 (用于下载)
      try {
        const env = await API.rawImage(preview.group, preview.name);
        if (env.status === "ok") {
          setDownloadUrl(`data:${env.data.mime};base64,${env.data.b64}`);
        }
      } catch {}
      setLoading(false);
    })();
  }, [preview]);

  if (!preview) return null;

  return (
    <Modal
      open={true}
      onCancel={() => setPreview(null)}
      footer={null}
      width="min(900px, 92vw)"
      title={preview.name}
      destroyOnClose
    >
      <div className="qg-preview-cover" style={{ textAlign: "center", minHeight: 200 }}>
        {loading && <Spin size="large" />}
        {url && <img src={url} alt={preview.name} style={{ maxWidth: "100%" }} />}
      </div>
      <div style={{ marginTop: 12, textAlign: "right" }}>
        <Button
          icon={<DownloadOutlined />}
          disabled={!downloadUrl}
          onClick={() => {
            if (!downloadUrl) return;
            const a = document.createElement("a");
            a.href = downloadUrl;
            a.download = preview.name;
            document.body.appendChild(a);
            a.click();
            a.remove();
          }}
        >
          {t(ctx, "preview.download")}
        </Button>
      </div>
    </Modal>
  );
}

// ------------------------------------------------------------------
// Settings modal
// ------------------------------------------------------------------
export function SettingsModal() {
  const ctx = useBridge();
  const selectedGroup = useUI((s) => s.selectedGroup);
  const show = useUI((s) => s.showSettings);
  const setShow = useUI((s) => s.setShowSettings);
  const [form] = Form.useForm();
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["settings", selectedGroup],
    queryFn: async () => {
      if (!selectedGroup) return null;
      const env = await API.getSettings(selectedGroup);
      if (env.status !== "ok") throw new Error(env.message);
      return env.data.settings;
    },
    enabled: !!selectedGroup && show,
  });

  useEffect(() => {
    if (q.data) {
      form.setFieldsValue({
        mode: q.data.mode ?? 0,
        coldown: q.data.coldown ?? 10,
      });
    }
  }, [q.data, form]);

  return (
    <Modal
      open={show}
      title={t(ctx, "settings.title", "", { group: selectedGroup ?? "" })}
      onCancel={() => setShow(false)}
      onOk={async () => {
        const v = await form.validateFields();
        if (!selectedGroup) return;
        const env = await API.updateSettings(selectedGroup, v);
        if (env.status !== "ok") {
          message.error(env.message || t(ctx, "error.saveSettings"));
          return;
        }
        message.success(t(ctx, "settings.saved"));
        qc.invalidateQueries({ queryKey: ["settings", selectedGroup] });
        setShow(false);
      }}
      destroyOnClose
    >
      {q.isLoading || !q.data ? (
        <Spin />
      ) : (
        <Form form={form} layout="vertical">
          <Form.Item name="mode" label={t(ctx, "settings.mode")}>
            <Radio.Group>
              <Space direction="vertical">
                <Radio value={0}>{t(ctx, "settings.mode0")}</Radio>
                <Radio value={1}>{t(ctx, "settings.mode1")}</Radio>
                <Radio value={2}>{t(ctx, "settings.mode2")}</Radio>
              </Space>
            </Radio.Group>
          </Form.Item>
          <Form.Item name="coldown" label={t(ctx, "settings.coldown")}>
            <InputNumber min={0} max={86400} style={{ width: 200 }} />
          </Form.Item>
        </Form>
      )}
    </Modal>
  );
}

// ------------------------------------------------------------------
// Move modal
// ------------------------------------------------------------------
export function MoveModal() {
  const ctx = useBridge();
  const show = useUI((s) => s.showMove);
  const setShow = useUI((s) => s.setShowMove);
  const selectedGroup = useUI((s) => s.selectedGroup);
  const selectedImages = useUI((s) => s.selectedImages);
  const clearSelection = useUI((s) => s.clearSelection);
  const qc = useQueryClient();
  const [dst, setDst] = useState("");
  const [loading, setLoading] = useState(false);

  return (
    <Modal
      open={show}
      title={t(ctx, "move.title")}
      onCancel={() => setShow(false)}
      onOk={async () => {
        if (!selectedGroup || !dst.trim()) {
          message.warning(t(ctx, "move.placeholder"));
          return;
        }
        setLoading(true);
        const env = await API.moveImages(selectedGroup, dst.trim(), Array.from(selectedImages));
        setLoading(false);
        if (env.status !== "ok") {
          message.error(env.message || t(ctx, "error.move"));
          return;
        }
        message.success(`${env.data.moved.length} moved`);
        clearSelection();
        qc.invalidateQueries({ queryKey: ["images", selectedGroup] });
        qc.invalidateQueries({ queryKey: ["groups"] });
        qc.invalidateQueries({ queryKey: ["overview"] });
        setShow(false);
      }}
      confirmLoading={loading}
      destroyOnClose
    >
      <Input
        placeholder={t(ctx, "move.placeholder")}
        value={dst}
        onChange={(e) => setDst(e.target.value)}
      />
      <div style={{ color: "var(--qg-muted)", marginTop: 8 }}>
        {t(ctx, "move.title")}: {selectedGroup} → <b>{dst || "?"}</b>
      </div>
    </Modal>
  );
}

// ------------------------------------------------------------------
// Upload modal
// ------------------------------------------------------------------
export function UploadModal() {
  const ctx = useBridge();
  const { message } = App.useApp();
  const show = useUI((s) => s.showUpload);
  const setShow = useUI((s) => s.setShowUpload);
  const selectedGroup = useUI((s) => s.selectedGroup);
  const qc = useQueryClient();
  const [fileList, setFileList] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);

  async function doUpload() {
    if (!selectedGroup || fileList.length === 0) return;
    setUploading(true);
    let ok = 0, fail = 0;
    for (const f of fileList) {
      const origin = f.originFileObj || f;
      try {
        const env = await API.upload(selectedGroup, origin);
        if (env.status === "ok") ok++;
        else fail++;
      } catch (e) {
        fail++;
      }
    }
    setUploading(false);
    if (ok) message.success(`${t(ctx, "upload.success")}: ${ok}`);
    if (fail) message.error(`${t(ctx, "error.upload")}: ${fail}`);
    setFileList([]);
    qc.invalidateQueries({ queryKey: ["images", selectedGroup] });
    qc.invalidateQueries({ queryKey: ["groups"] });
    qc.invalidateQueries({ queryKey: ["overview"] });
    setShow(false);
  }

  return (
    <Modal
      open={show}
      title={t(ctx, "upload.title")}
      onCancel={() => setShow(false)}
      onOk={doUpload}
      confirmLoading={uploading}
      okText={t(ctx, "toolbar.upload")}
      destroyOnClose
    >
      {selectedGroup ? (
        <Alert
          type="info"
          showIcon
          message={t(ctx, "upload.groupHint") + ": " + selectedGroup}
          style={{ marginBottom: 12 }}
        />
      ) : (
        <Alert type="warning" showIcon message="请先在左侧选择一个群" style={{ marginBottom: 12 }} />
      )}
      <Upload.Dragger
        multiple
        beforeUpload={() => false}
        fileList={fileList}
        onChange={({ fileList }) => setFileList(fileList)}
        accept="image/*"
        listType="picture"
      >
        <p className="ant-upload-drag-icon"><InboxOutlined /></p>
        <p className="ant-upload-text">{t(ctx, "upload.hint")}</p>
      </Upload.Dragger>
    </Modal>
  );
}
