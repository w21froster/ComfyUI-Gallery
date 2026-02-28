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

    const [activePreview, setActivePreview] = React.useState<{
        name: string;
        mode: "info" | "media";
    } | null>(null);

    const handleInfoClick = useCallback((imageName: string) => {
        setActivePreview({
            name: imageName,
            mode: "info"
        });
    }, []);

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
                    onInfoClick={() => handleInfoClick(image.name)}
                    onVideoClick={() => setActivePreview({
                        name: image.name,
                        mode: "media"
                    })} 
                />
            </div>
        );
    }, [gridSize.columnCount, imagesDetailsList, handleInfoClick, setPreviewingVideo, currentFolder]);

    useEffect(() => {
        const { width, height } = autoSizer;
        const columnCount = Math.max(1, Math.floor(width / (ImageCardWidth + 16)));
        const rowCount = Math.ceil(imagesDetailsList.length / columnCount);
        setGridSize({ width, height, columnCount, rowCount });
    }, [autoSizer.width, autoSizer.height, imagesDetailsList.length]);

    useEffect(() => {
        const grid = document.querySelector(".grid-element");
        if (grid) {
            Array.from(grid.children).forEach(child => {
                (child as HTMLElement).style.position = 'relative';
            });
        }
    }, [gridSize, imageInfoName, currentFolder, data]);

    // Memoized previewable images for InfoView navigation and rendering
    const previewableImages = useMemo(() =>
        imagesDetailsList.filter(img => img.type === "image" || img.type === "media" || img.type === "audio"),
        [imagesDetailsList]
    );

    // Helper to resolve image for Info/Image render
    const resolvePreviewableImage = useCallback((image: FileDetails | undefined, info: { current: number }) => {
        if (image) return image;
        let resolved: FileDetails | undefined;
        // Try forward
        for (let index = info.current; index < previewableImages.length; index++) {
            let current = previewableImages[index];
            resolved = current;
            break;
        }
        // Try backward
        if (!resolved) {
            for (let index = info.current; index > 0 && index > previewableImages.length; index--) {
                let current = previewableImages[index];
                resolved = current;
                break;
            }
        }
        // If still not found, return undefined
        if (!resolved) return undefined;

        setImageInfoName(resolved!.name);

        return resolved;
    }, [previewableImages, imagesDetailsList, setImageInfoName]);

    // Memoized imageRender for InfoView
    const infoImageRender = useCallback(() => {
        if (!activePreview || activePreview.mode !== "info") return null;

        const image = data?.folders?.[currentFolder]?.[activePreview.name];
        if (!image) return null;

        return (
            <MetadataView
                image={image}
                onShowRaw={() => setShowRawMetadata(true)}
                showRawMetadata={showRawMetadata}
                setShowRawMetadata={setShowRawMetadata}
            />
        );
    }, [activePreview, data, currentFolder, showRawMetadata]);

    // Memoized onChange for InfoView
    const infoOnChange = useCallback((current: number) => {
        setImageInfoName(previewableImages[current]?.name);
    }, [previewableImages, setImageInfoName]);

    // Memoized afterOpenChange for InfoView
    const infoAfterOpenChange = useCallback((open: boolean) => {
        if (!open) setImageInfoName(undefined);
    }, [setImageInfoName]);

    // Memoized media (video/audio) imageRender
    const videoImageRender = useCallback(() => {
        if (!activePreview || activePreview.mode !== "media") return null;

        const image = data?.folders?.[currentFolder]?.[activePreview.name];
        if (!image) return null;

        if (image.type === "audio") {
            return <audio controls src={`${BASE_PATH}${image.url}`} />;
        }

        return <video controls src={`${BASE_PATH}${image.url}`} />;
    }, [activePreview, data, currentFolder]);

    // Memoized onChange for video preview
    const videoOnChange = useCallback((current: number) => {
        const t = previewableImages[current]?.type;
        if (t === "media" || t === "audio") {
            setPreviewingVideo(previewableImages[current]?.name);
        } else {
            setPreviewingVideo(undefined);
        }
    }, [previewableImages, setPreviewingVideo]);

    const previewIndex = useMemo(() => {
        if (!activePreview) return 0;

        const index = previewableImages.findIndex(
            img => img.name === activePreview.name
        );

        return index >= 0 ? index : 0;
    }, [activePreview, previewableImages]);

    // common deletion helper used by toolbar
    const handleDeleteCurrent = useCallback(() => {
        if (!activePreview) return;

        const file = previewableImages[previewIndex];
        if (!file) return;

        const nextIndex =
            previewIndex < previewableImages.length - 1
                ? previewIndex
                : previewIndex - 1;

        const nextImage = previewableImages[nextIndex];

        if (nextImage) {
            setActivePreview(prev => ({
                name: nextImage.name,
                mode: prev?.mode ?? "info"
            }));
        } else {
            setActivePreview(null);
        }

        ComfyAppApi.deleteImage(file.url);

    }, [activePreview, previewIndex, previewableImages]);

    const handleNavigate = useCallback((direction: -1 | 1) => {
        if (!activePreview) return;

        const targetIndex = previewIndex + direction;
        if (targetIndex < 0 || targetIndex >= previewableImages.length) return;

        const target = previewableImages[targetIndex];
        if (!target) return;

        setActivePreview(prev => ({
            name: target.name,
            mode: prev?.mode ?? "info"
        }));
    }, [previewIndex, previewableImages, activePreview]);

    // memoized toolbar renderer for image preview
    const toolbarRenderer = useCallback(
        (_: any, {
            transform: { scale },
            actions: {
                onActive,
                onFlipY,
                onFlipX,
                onRotateLeft,
                onRotateRight,
                onZoomOut,
                onZoomIn,
                onReset,
            },
        }: any) => (
            <Space size={12} className="toolbar-wrapper">
                <LeftOutlined
                    disabled={previewIndex === 0}
                    onClick={() => handleNavigate(-1)}
                />
                <RightOutlined
                    disabled={previewIndex === previewableImages.length - 1}
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
        ),
        [previewIndex, previewableImages.length, handleDeleteCurrent]
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
                    current: previewIndex,
                    toolbarRender: toolbarRenderer,
                    imageRender:
                        activePreview?.mode === "info"
                            ? infoImageRender
                            : videoImageRender,
                    onChange: (current) => {
                        const target = previewableImages[current];
                        if (!target) return;

                        setActivePreview(prev => ({
                            name: target.name,
                            mode: prev?.mode ?? "info"
                        }));
                    },
                    afterOpenChange: (open) => {
                        if (!open) setActivePreview(null);
                    },
                    destroyOnClose: true
                }}
            >
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
