import React, { useMemo, useCallback, useEffect, useRef } from 'react';
import {
  DeleteOutlined,
  LeftOutlined,
  RightOutlined,
  RotateLeftOutlined,
  RotateRightOutlined,
  SwapOutlined,
  UndoOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
} from '@ant-design/icons';
import { Empty, Image, Space, Spin } from 'antd';
import { AutoSizer } from 'react-virtualized';
import { FixedSizeGrid } from 'react-window';
import ImageCard, { ImageCardHeight, ImageCardWidth } from './ImageCard';
import { useGalleryContext } from './GalleryContext';
import { MetadataView } from './MetadataView';
import type { FileDetails } from './types';
import { ComfyAppApi, BASE_PATH } from "./ComfyAppApi";

const GalleryImageGrid = () => {
    const {
        data,
        currentFolder,
        searchFileName,
        sortMethod,
        gridSize,
        setGridSize,
        autoSizer,
        setAutoSizer,
        imageInfoName,
        setImageInfoName,
        previewingVideo,
        setPreviewingVideo,
        showRawMetadata,
        setShowRawMetadata,
        settings,
        loading 
    } = useGalleryContext();
    const containerRef = useRef<HTMLDivElement>(null);
    const imagesDetailsList = useMemo(() => {
        let list: FileDetails[] = Object.values(data?.folders?.[currentFolder] ?? []);
        if (searchFileName && searchFileName.trim() !== "") {
            const searchTerm = searchFileName.toLowerCase();
            list = list.filter(imageInfo => imageInfo.name.toLowerCase().includes(searchTerm));
        }
        if (sortMethod !== 'Name ↑' && sortMethod !== 'Name ↓') {
            list = list.sort((a, b) => (sortMethod === 'Newest' ? (b.timestamp || 0) - (a.timestamp || 0) : (a.timestamp || 0) - (b.timestamp || 0)));
            if (!settings.showDateDivider) return list;
            const grouped: { [date: string]: FileDetails[] } = {};
            list.forEach(item => {
                const date = item.timestamp ? new Date(item.timestamp * 1000).toISOString().slice(0, 10) : 'Unknown';
                if (!grouped[date]) grouped[date] = [];
                grouped[date].push(item);
            });
            const result: FileDetails[] = [];
            Object.entries(grouped).forEach(([date, items]) => {
                const colCount = Math.max(1, gridSize.columnCount || 1);
                for (let i = 0; i < colCount; i++) {
                    result.push({ name: date, type: 'divider' } as FileDetails);
                }
                result.push(...items);
                const remainder = items.length % colCount;
                if (remainder !== 0 && colCount > 1) {
                    for (let i = 0; i < colCount - remainder; i++) {
                        result.push({ type: 'empty-space' } as FileDetails);
                    }
                }
            });
            return result;
        }
        switch (sortMethod) {
            case 'Name ↑':
                return list.sort((a, b) => a.name.localeCompare(b.name));
            case 'Name ↓':
                return list.sort((a, b) => b.name.localeCompare(a.name));
            default:
                return list;
        }
    }, [currentFolder, data, sortMethod, searchFileName, gridSize.columnCount, settings.showDateDivider]);

    const imagesUrlsLists = useMemo(() =>
        imagesDetailsList.filter(image => image.type === "image" || image.type === "media" || image.type === "audio").map(image => `${BASE_PATH}${image.url}`),
        [imagesDetailsList]
    );

    const [previewState, setPreviewState] = React.useState<{
        index: number;
        mode: "image" | "info" | "media";
    } | null>(null);

    // Memoized previewable images for InfoView navigation and rendering
    const previewableImages = useMemo(() =>
        imagesDetailsList.filter(img => img.type === "image" || img.type === "media" || img.type === "audio"),
        [imagesDetailsList]
    );

    const handleInfoClick = useCallback((imageName: string) => {
    const index = previewableImages.findIndex(
        img => img.name === imageName
    );

    if (index === -1) return;

    setPreviewState({
        index,
        mode: "info"
    });
    }, [previewableImages]);

    const Cell = useCallback(({ columnIndex, rowIndex, style }: { columnIndex: number; rowIndex: number; style: React.CSSProperties }) => {
        const index = rowIndex * gridSize.columnCount + columnIndex;
        const image = imagesDetailsList[index];
        if (!image) return null;
        if (image.type === 'divider') {
            if (columnIndex !== 0) return null;
            return (
                <div 
                    key={`divider-${index}`} 
                    style={{ 
                        ...style, 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        width: `calc(${gridSize.columnCount} * ${ImageCardWidth + 16}px)`, 
                        gridColumn: `span ${gridSize.columnCount}`, 
                        background: 'transparent', 
                        padding: 0, 
                        minHeight: 48, 
                        position: 'absolute', 
                        zIndex: 2 
                    }}
                >
                    <div 
                        style={{ 
                            width: '100%', 
                            display: 'flex', 
                            alignItems: 'center', 
                            position: 'relative' 
                        }}
                    >
                        <div 
                            style={{ 
                                flex: 1, 
                                borderBottom: '2px solid #888', 
                                opacity: 0.3 
                            }} 
                        />
                        <span 
                            style={{ 
                                margin: '0 24px', 
                                fontWeight: 700, 
                                fontSize: 22, 
                                color: '#ccc', 
                                background: '#23272f', 
                                borderRadius: 8, 
                                padding: '2px 24px', 
                                boxShadow: '0 2px 8px rgba(0,0,0,0.08)', 
                                border: '1px solid #333', 
                                display: 'flex', 
                                alignItems: 'center', 
                                height: 40 
                            }}
                        >
                            {image.name}
                        </span>
                        <div 
                            style={{ 
                                flex: 1, 
                                borderBottom: '2px solid #888', 
                                opacity: 0.3 
                            }} 
                        />
                    </div>
                </div>
            );
        }
        if (image.type === 'empty-space') {
            return (
                <div 
                    key={`empty-space-${index}`} 
                    style={{ 
                        ...style, 
                        background: 'transparent' 
                    }} 
                />
            );
        }
        // Add folder info to drag data by wrapping ImageCard
        return (
            <div 
                key={`div-${image.name}`} 
                style={{ 
                    ...style, 
                    display: 'flex', 
                    justifyContent: 'center', 
                    alignItems: 'center' 
                }}
            >
                <ImageCard 
                    image={{ 
                        ...image, 
                        dragFolder: currentFolder 
                    }} 
                    key={image.name} 
                    index={index} 
                    onInfoClick={() =>
                        setPreviewState({
                            index: previewableImages.findIndex(i => i.name === image.name),
                            mode: "info"
                        })
                    }
                    onVideoClick={() =>
                    setPreviewState({
                        index: previewableImages.findIndex(i => i.name === image.name),
                        mode: "media"
                    })
                    }
                />
            </div>
        );
    }, [gridSize.columnCount, imagesDetailsList, handleInfoClick, setPreviewingVideo, currentFolder]);

    useEffect(() => {
        const { width, height } = autoSizer;
        const columnCount = Math.max(1, Math.floor(width / (ImageCardWidth + 16)));
        const rowCount = Math.ceil(imagesDetailsList.length / columnCount);
        setGridSize({ width, height, columnCount, rowCount });
    }, [autoSizer.width, autoSizer.height, imagesDetailsList.length, setGridSize]);

    useEffect(() => {
        const grid = document.querySelector(".grid-element");
        if (grid) {
            Array.from(grid.children).forEach(child => {
                (child as HTMLElement).style.position = 'relative';
            });
        }
    }, [gridSize, imageInfoName, currentFolder, data]);

    const renderPreviewContent = useCallback(
    (originNode: React.ReactNode) => {
        if (!previewState) return originNode;

        const file = previewableImages[previewState.index];
        if (!file) return originNode;

        if (previewState.mode === "info") {
        return (
            <MetadataView
            image={file}
            onShowRaw={() => setShowRawMetadata(true)}
            showRawMetadata={showRawMetadata}
            setShowRawMetadata={setShowRawMetadata}
            />
        );
        }

        if (previewState.mode === "media") {
        if (file.type === "audio") {
            return (
            <audio
                controls
                style={{ maxWidth: "100%" }}
                src={`${BASE_PATH}${file.url}`}
            />
            );
        }

        if (file.type === "media") {
            return (
            <video
                controls
                style={{ maxWidth: "100%" }}
                src={`${BASE_PATH}${file.url}`}
            />
            );
        }
        }

        return originNode;
    },
    [previewState, previewableImages, showRawMetadata]
    );

    // Memoized onChange for InfoView
    const infoOnChange = useCallback((current: number) => {
        setImageInfoName(previewableImages[current]?.name);
    }, [previewableImages, setImageInfoName]);

    // Memoized afterOpenChange for InfoView
    const infoAfterOpenChange = useCallback((open: boolean) => {
        if (!open) setImageInfoName(undefined);
    }, [setImageInfoName]);

    // Memoized onChange for video preview
    const videoOnChange = useCallback((current: number) => {
        const t = previewableImages[current]?.type;
        if (t === "media" || t === "audio") {
            setPreviewingVideo(previewableImages[current]?.name);
        } else {
            setPreviewingVideo(undefined);
        }
    }, [previewableImages, setPreviewingVideo]);

    // common deletion helper used by toolbar
    const handleDeleteCurrent = useCallback(() => {
    if (!previewState) return;

    const file = previewableImages[previewState.index];
    if (!file) return;

    ComfyAppApi.deleteImage(file.url);

    const nextIndex =
        previewState.index < previewableImages.length - 1
        ? previewState.index
        : previewState.index - 1;

    if (nextIndex >= 0) {
        setPreviewState(prev =>
        prev
            ? { ...prev, index: nextIndex }
            : null
        );
    } else {
        setPreviewState(null);
    }
    }, [previewState, previewableImages]);

    const handleNavigate = useCallback(
    (direction: -1 | 1) => {
        if (!previewState) return;

        const nextIndex = previewState.index + direction;
        if (nextIndex < 0 || nextIndex >= previewableImages.length) return;

        setPreviewState(prev =>
        prev
            ? { ...prev, index: nextIndex }
            : null
        );
    },
    [previewState, previewableImages.length]
    );

    // memoized toolbar renderer for image preview
    const toolbarRenderer = useCallback(
    (_: any, {
        transform: { scale },
        actions: {
        onFlipY,
        onFlipX,
        onRotateLeft,
        onRotateRight,
        onZoomOut,
        onZoomIn,
        onReset,
        },
    }: any) => {
        const index = previewState?.index ?? 0;

        return (
        <Space size={12} className="toolbar-wrapper">
            <LeftOutlined
            disabled={index === 0}
            onClick={() => handleNavigate(-1)}
            />
            <RightOutlined
            disabled={index === previewableImages.length - 1}
            onClick={() => handleNavigate(1)}
            />
            <SwapOutlined rotate={90} onClick={onFlipY} />
            <SwapOutlined onClick={onFlipX} />
            <RotateLeftOutlined onClick={onRotateLeft} />
            <RotateRightOutlined onClick={onRotateRight} />
            <ZoomOutOutlined disabled={scale === 1} onClick={onZoomOut} />
            <ZoomInOutlined disabled={scale === 50} onClick={onZoomIn} />
            <UndoOutlined onClick={onReset} />
            <DeleteOutlined onClick={handleDeleteCurrent} />
        </Space>
        );
    },
    [previewState, previewableImages.length, handleNavigate, handleDeleteCurrent]
    );

    return (
        <div id="imagesBox" style={{ width: '100%', height: '100%', position: 'relative' }} ref={containerRef}>
            {loading && (
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    background: 'rgba(30,30,30,0.5)',
                    zIndex: 100,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}>
                    <Spin size="large" tip="Loading..." />
                </div>
            )}
            <Image.PreviewGroup
            preview={{
                current: previewState?.index ?? 0,
                imageRender: renderPreviewContent,
                toolbarRender: toolbarRenderer,
                onChange: (current) => {
                setPreviewState(prev =>
                    prev
                    ? { ...prev, index: current }
                    : { index: current, mode: "image" }
                );
                },
                afterOpenChange: (open) => {
                if (!open) setPreviewState(null);
                },
                destroyOnClose: true
            }}
            >
                {previewableImages.map((img) => (
                <Image
                    key={`preview-${img.name}`}
                    src={`${BASE_PATH}${img.url}`}
                    style={{ display: "none" }}
                />
                ))}
                {imagesDetailsList.length === 0 ? (
                    <Empty 
                        style={{ 
                            position: "absolute", 
                            top: "50%", 
                            left: "50%", 
                            transform: "translate(-50%, -50%)" 
                        }} 
                        description={"No images found"} 
                    />
                ) : (
                    <AutoSizer>
                        {({ width, height }) => {
                            if (autoSizer.width !== width || autoSizer.height !== height) {
                                setTimeout(() => setAutoSizer({ width, height }), 0);
                            }
                            return (
                                <FixedSizeGrid
                                    columnCount={gridSize.columnCount}
                                    rowCount={gridSize.rowCount}
                                    columnWidth={ImageCardWidth + 16}
                                    rowHeight={ImageCardHeight + 16}
                                    width={width}
                                    height={height}
                                    className={"grid-element"}
                                    style={{ 
                                        display: "flex", 
                                        alignContent: "center", 
                                        justifyContent: "center" 
                                    }}
                                >
                                    {Cell}
                                </FixedSizeGrid>
                            );
                        }}
                    </AutoSizer>
                )}
            </Image.PreviewGroup>
        </div>
    );
};

export default GalleryImageGrid;
