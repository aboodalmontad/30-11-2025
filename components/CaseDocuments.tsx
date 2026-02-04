
import * as React from 'react';
import { useData } from '../context/DataContext';
import { CaseDocument } from '../types';
import { DocumentArrowUpIcon, TrashIcon, EyeIcon, DocumentTextIcon, PhotoIcon, XMarkIcon, ExclamationTriangleIcon, ArrowPathIcon, CameraIcon, CloudArrowUpIcon, CloudArrowDownIcon, CheckCircleIcon, ExclamationCircleIcon, ArrowDownTrayIcon, ShieldCheckIcon, FolderIcon } from './icons';
import { renderAsync } from 'docx-preview';

interface CaseDocumentsProps {
    caseId: string;
}

const SyncStatusIcon: React.FC<{ state: CaseDocument['localState'] }> = ({ state }) => {
    // WhatsApp-like indicators
    switch (state) {
        case 'synced':
            // Double Blue Check: Received & Downloaded (Available locally and server)
            return (
                <div className="flex -space-x-1" title="تم التحميل والحفظ محلياً">
                    <CheckCircleIcon className="w-4 h-4 text-blue-500" />
                    <CheckCircleIcon className="w-4 h-4 text-blue-500" />
                </div>
            );
        case 'archived':
            // Double Green Check or Database Icon: Archived Locally (Deleted from server to save space, but safe here)
            return (
                <div className="flex items-center gap-1 bg-green-100 px-1.5 rounded-full" title="مؤرشف محلياً (تم حذفه من السحابة لتوفير المساحة)">
                    <CheckCircleIcon className="w-3 h-3 text-green-600" />
                    <span className="text-[10px] text-green-700 font-bold">محفوظ</span>
                </div>
            );
        case 'pending_upload':
            // Clock icon: Waiting to leave device
            return <ArrowPathIcon className="w-4 h-4 text-gray-400 animate-spin" title="جاري الإرسال..." />;
        case 'pending_download':
            // Single Grey Check: Delivered to Server, waiting for download
            return <CheckCircleIcon className="w-4 h-4 text-gray-400" title="وصل للسحابة (اضغط للتنزيل)" />;
        case 'downloading':
            return <CloudArrowDownIcon className="w-4 h-4 text-blue-500 animate-bounce" title="جاري التنزيل..." />;
        case 'error':
            return <ExclamationCircleIcon className="w-4 h-4 text-red-500" title="فشل" />;
        case 'expired':
            // Red exclamation: Gone from server and not here
            return <ExclamationTriangleIcon className="w-4 h-4 text-red-500" title="منتهي الصلاحية (غير موجود في السحابة)" />;
        default:
            return null;
    }
};

const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const FilePreview: React.FC<{ doc: CaseDocument, onPreview: (doc: CaseDocument) => void, onDelete: (doc: CaseDocument) => void }> = ({ doc, onPreview, onDelete }) => {
    const [thumbnailUrl, setThumbnailUrl] = React.useState<string | null>(null);
    const [isLoadingThumbnail, setIsLoadingThumbnail] = React.useState(false);
    const { getDocumentFile } = useData();

    React.useEffect(() => {
        let objectUrl: string | null = null;
        let isMounted = true;
        const generateThumbnail = async () => {
            // Only generate thumbnails for images that are available locally
            if ((doc.localState !== 'synced' && doc.localState !== 'archived') || !doc.type.startsWith('image/')) {
                 setIsLoadingThumbnail(false);
                 return;
            }

            setIsLoadingThumbnail(true);
            const file = await getDocumentFile(doc.id);
            if (!file || !isMounted) {
                setIsLoadingThumbnail(false);
                return;
            }

            if (doc.type.startsWith('image/')) {
                objectUrl = URL.createObjectURL(file);
                setThumbnailUrl(objectUrl);
            }
            setIsLoadingThumbnail(false);
        };

        generateThumbnail();

        return () => {
            isMounted = false;
            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
            }
        };
    }, [doc.id, doc.type, doc.localState, getDocumentFile]);
    
    // Determine card background based on state
    const isAvailable = doc.localState === 'synced' || doc.localState === 'archived';
    const isExpired = doc.localState === 'expired';
    const cardBg = isExpired ? 'bg-red-50 opacity-75' : isAvailable ? 'bg-white' : 'bg-gray-50';
    const borderClass = isExpired ? 'border-red-200' : 'border-gray-200';
    
    return (
        <div 
            className={`relative group border ${borderClass} rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 flex flex-col ${cardBg}`}
            title={isExpired ? "هذا الملف لم يعد متاحاً في السحابة" : doc.name}
        >
            {/* Action Overlay */}
            <div className="absolute top-2 right-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={(e) => { e.stopPropagation(); onDelete(doc); }} className="p-1.5 bg-white text-red-600 rounded-full shadow-md hover:bg-red-50 border border-gray-100">
                    <TrashIcon className="w-4 h-4" />
                </button>
            </div>

            {/* Thumbnail / Icon Area */}
            <div 
                className={`aspect-w-1 aspect-h-1 flex items-center justify-center cursor-pointer overflow-hidden relative ${isAvailable ? 'bg-gray-100' : 'bg-gray-200'}`}
                onClick={() => onPreview(doc)}
            >
                {isLoadingThumbnail ? (
                     <div className="w-full h-full flex items-center justify-center">
                        <ArrowPathIcon className="w-6 h-6 text-gray-400 animate-spin"/>
                    </div>
                ) : thumbnailUrl ? (
                    <img src={thumbnailUrl} alt={doc.name} className="object-cover w-full h-full transition-transform duration-300 group-hover:scale-105" />
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 gap-2 p-4">
                        {doc.type.includes('pdf') ? <DocumentTextIcon className="w-12 h-12 text-red-400"/> : 
                         doc.type.includes('image') ? <PhotoIcon className="w-12 h-12 text-purple-400"/> :
                         <DocumentTextIcon className="w-12 h-12 text-blue-400"/>}
                         {!isAvailable && !isExpired && <span className="text-[10px] font-bold bg-white/70 px-2 py-1 rounded-full text-gray-600 shadow-sm">اضغط للتحميل</span>}
                    </div>
                )}
                
                {/* Overlay for expired/missing */}
                {isExpired && (
                    <div className="absolute inset-0 bg-white/80 flex flex-col items-center justify-center backdrop-blur-[1px]">
                        <ExclamationTriangleIcon className="w-8 h-8 text-red-500 mb-1" />
                        <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded border border-red-100">منتهي الصلاحية</span>
                    </div>
                )}
            </div>

            {/* Meta Data Footer */}
            <div className="p-2.5 border-t border-gray-100 flex flex-col gap-1.5 bg-white/50 backdrop-blur-sm">
                <div className="flex justify-between items-start gap-2">
                    <p className="text-xs font-semibold text-gray-800 truncate flex-grow text-right" dir="auto">{doc.name}</p>
                    <div className="flex-shrink-0">
                        <SyncStatusIcon state={doc.localState} />
                    </div>
                </div>
                <div className="flex justify-between items-center text-[10px] text-gray-500 font-medium">
                    <span>{formatFileSize(doc.size)}</span>
                    <span className="uppercase tracking-wider bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">{doc.name.split('.').pop()?.slice(0,4) || 'FILE'}</span>
                </div>
            </div>
        </div>
    );
};

const TextPreview: React.FC<{ file: File; name: string }> = ({ file, name }) => {
    const [content, setContent] = React.useState<string | null>(null);
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        const reader = new FileReader();
        reader.onload = (e) => setContent(e.target?.result as string);
        reader.onerror = () => setError('خطأ في قراءة الملف.');
        reader.readAsText(file);
    }, [file]);

    return (
        <div className="w-full h-full bg-gray-100 p-4 rounded-lg overflow-auto flex flex-col">
            <h3 className="text-lg font-semibold border-b border-gray-300 pb-2 mb-4 text-gray-800 flex-shrink-0">{name}</h3>
            <div className="flex-grow bg-white p-6 rounded shadow-inner overflow-auto">
                {content === null && !error && <div className="text-center p-8 text-gray-600">جاري تحميل المحتوى...</div>}
                {error && <div className="text-center p-8 text-red-600">{error}</div>}
                {content && <pre className="text-sm whitespace-pre-wrap text-gray-800">{content}</pre>}
            </div>
        </div>
    );
};

const DocxPreview: React.FC<{ file: File; name: string; onClose: () => void; onDownload: () => void }> = ({ file, name, onClose, onDownload }) => {
    const previewerRef = React.useRef<HTMLDivElement>(null);
    const [error, setError] = React.useState<string | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const isOldDocFormat = name.toLowerCase().endsWith('.doc');

    React.useEffect(() => {
        if (isOldDocFormat || !previewerRef.current) {
            setIsLoading(false);
            return;
        }

        renderAsync(file, previewerRef.current)
            .then(() => {
                setIsLoading(false);
            })
            .catch(e => {
                console.error('Docx-preview error:', e);
                setError('حدث خطأ أثناء عرض المستند. قد يكون الملف تالفًا أو غير مدعوم. جرب تنزيل الملف بدلاً من ذلك.');
                setIsLoading(false);
            });
    }, [file, isOldDocFormat]);

    return (
        <div className="w-full h-full bg-gray-100 p-4 rounded-lg overflow-auto flex flex-col">
            <div className="flex justify-between items-center border-b border-gray-300 pb-2 mb-4 flex-shrink-0">
                <h3 className="text-lg font-semibold text-gray-800">{name}</h3>
                <div className="flex items-center gap-4">
                    <button onClick={onDownload} className="flex items-center gap-2 text-sm px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                        <ArrowDownTrayIcon className="w-4 h-4" />
                        <span>تنزيل الملف</span>
                    </button>
                    <button onClick={onClose} className="p-2 text-gray-500 hover:bg-gray-200 rounded-full">
                        <XMarkIcon className="w-5 h-5" />
                    </button>
                </div>
            </div>
            <div className="flex-grow bg-white p-2 rounded shadow-inner overflow-auto relative">
                {isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/70">
                        <ArrowPathIcon className="w-8 h-8 text-blue-600 animate-spin" />
                    </div>
                )}
                {isOldDocFormat ? (
                    <div className="flex flex-col items-center justify-center h-full text-center p-8">
                        <ExclamationTriangleIcon className="w-12 h-12 text-yellow-500 mb-4" />
                        <h4 className="text-lg font-bold text-gray-800">تنسيق ملف غير مدعوم للمعاينة</h4>
                        <p className="text-gray-600 mt-2">
                            لا يمكن عرض ملفات Word القديمة (ذات امتداد .doc) مباشرة في المتصفح. يرجى استخدام زر التنزيل لفتح الملف باستخدام Microsoft Word.
                        </p>
                    </div>
                ) : error ? (
                    <div className="flex flex-col items-center justify-center h-full text-center p-8">
                         <ExclamationCircleIcon className="w-12 h-12 text-red-500 mb-4" />
                         <h4 className="text-lg font-bold text-red-800">فشل عرض الملف</h4>
                         <p className="text-gray-600 mt-2">{error}</p>
                    </div>
                ) : (
                    <div ref={previewerRef} />
                )}
            </div>
        </div>
    );
};

const PreviewModal: React.FC<{ doc: CaseDocument; onClose: () => void }> = ({ doc, onClose }) => {
    const { getDocumentFile, documents } = useData();
    const [file, setFile] = React.useState<File | null>(null);
    const [objectUrl, setObjectUrl] = React.useState<string | null>(null);
    const [error, setError] = React.useState<string | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);

    // Get the latest doc state from context, in case it was updated by a download
    const currentDoc = documents.find(d => d.id === doc.id) || doc;

    React.useEffect(() => {
        let url: string | null = null;
        const loadFile = async () => {
            setIsLoading(true);
            setError(null);
            try {
                // getDocumentFile now handles downloading and updates state internally
                const retrievedFile = await getDocumentFile(doc.id);
                
                if (retrievedFile) {
                    setFile(retrievedFile);
                    url = URL.createObjectURL(retrievedFile);
                    setObjectUrl(url);
                } else {
                    const latestDocState = documents.find(d => d.id === doc.id)?.localState;
                    if (latestDocState === 'error') {
                        setError('فشل تنزيل الملف. يرجى التحقق من اتصالك بالإنترنت.');
                    } else if (latestDocState === 'expired') {
                        setError('عذراً، انتهت صلاحية هذا الملف وتم حذفه من الخادم.');
                    } else {
                        setError('جاري محاولة التنزيل... يرجى الانتظار.');
                    }
                }
            } catch (e: any) {
                setError('حدث خطأ غير متوقع: ' + e.message);
            } finally {
                setIsLoading(false);
            }
        };

        loadFile();
            
        return () => {
            if (url) {
                URL.revokeObjectURL(url);
            }
        };
    }, [doc.id, getDocumentFile]);


    const handleDownload = () => {
        if (objectUrl) {
            const a = document.createElement('a');
            a.href = objectUrl;
            a.download = doc.name;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }
    };

    const renderPreview = () => {
        if (!file || !objectUrl) return null;
        
        // Show a loading indicator if the file is currently being downloaded
        if (currentDoc.localState === 'downloading') {
            return (
                <div className="flex flex-col items-center justify-center h-full">
                    <CloudArrowDownIcon className="w-12 h-12 text-blue-500 animate-spin mb-4" />
                    <p className="text-gray-700">جاري تنزيل الملف...</p>
                </div>
            );
        }

        if (file.type.startsWith('image/')) return <img src={objectUrl} alt={doc.name} className="max-h-full max-w-full object-contain mx-auto" />;
        if (file.type.startsWith('text/')) return <TextPreview file={file} name={doc.name} />;
        if (doc.name.toLowerCase().endsWith('.docx') || doc.name.toLowerCase().endsWith('.doc')) {
             return <DocxPreview file={file} name={doc.name} onClose={onClose} onDownload={handleDownload} />;
        }
        return (
            <div className="text-center p-8 flex flex-col items-center justify-center h-full">
                <DocumentTextIcon className="w-16 h-16 text-gray-400 mb-4" />
                <h3 className="font-bold text-lg">لا توجد معاينة متاحة</h3>
                <p className="text-gray-600">تنسيق الملف ({doc.type}) غير مدعوم للمعاينة المباشرة.</p>
                <button onClick={handleDownload} className="mt-6 flex items-center mx-auto gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    <ArrowDownTrayIcon className="w-5 h-5" />
                    <span>تنزيل الملف ({ (file.size / (1024 * 1024)).toFixed(2) } MB)</span>
                </button>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white rounded-lg shadow-xl w-full h-full max-w-4xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                {isLoading && <div className="flex items-center justify-center h-full"><ArrowPathIcon className="w-8 h-8 animate-spin text-blue-500" /></div>}
                {error && <div className="flex flex-col items-center justify-center h-full p-4"><ExclamationTriangleIcon className="w-10 h-10 text-red-500 mb-4"/><p className="text-red-700 text-center">{error}</p></div>}
                {!isLoading && !error && renderPreview()}
            </div>
        </div>
    );
};


const DocumentScannerModal: React.FC<{ onClose: () => void; onCapture: (file: File) => void }> = ({ onClose, onCapture }) => {
    // ... (Camera modal implementation stays exactly same as before, omitted for brevity but assumed present in final output)
    const videoRef = React.useRef<HTMLVideoElement>(null);
    const canvasRef = React.useRef<HTMLCanvasElement>(null);
    const streamRef = React.useRef<MediaStream | null>(null);
    const [error, setError] = React.useState<string | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const [isPreview, setIsPreview] = React.useState(false);

    React.useEffect(() => {
        const startCamera = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const constraints = { video: { facingMode: 'environment', width: { ideal: 4096 }, height: { ideal: 2160 } } };
                streamRef.current = await navigator.mediaDevices.getUserMedia(constraints);
                if (videoRef.current) {
                    videoRef.current.srcObject = streamRef.current;
                }
            } catch (err) {
                console.warn("High-res camera request failed, trying default:", err);
                try {
                    streamRef.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
                    if (videoRef.current) {
                        videoRef.current.srcObject = streamRef.current;
                    }
                } catch (fallbackErr) {
                     console.error("Error accessing camera:", fallbackErr);
                     setError('لم يتمكن من الوصول إلى الكاميرا. يرجى التحقق من الأذونات وتحديث الصفحة.');
                }
            } finally {
                setIsLoading(false);
            }
        };

        startCamera();

        return () => {
            streamRef.current?.getTracks().forEach(track => track.stop());
        };
    }, []);

    const handleCapture = () => {
        if (videoRef.current && canvasRef.current && !isLoading) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const context = canvas.getContext('2d', { willReadFrequently: true });
            if (!context) return;
            
            context.filter = 'grayscale(1) contrast(1.5) brightness(1.15)';
            context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
            
            setIsPreview(true);
        }
    };
    
    const handleSave = () => {
        if (canvasRef.current) {
            canvasRef.current.toBlob(blob => {
                if (blob) {
                    const fileName = `document-${new Date().toISOString()}.jpeg`;
                    const file = new File([blob], fileName, { type: 'image/jpeg' });
                    onCapture(file);
                }
            }, 'image/jpeg', 0.92);
        }
    };

    const handleRetake = () => {
        const canvas = canvasRef.current;
        const context = canvas?.getContext('2d');
        if (canvas && context) {
            context.filter = 'none';
            context.clearRect(0, 0, canvas.width, canvas.height);
        }
        setIsPreview(false);
    };

    return (
        <div className="fixed inset-0 bg-black z-50 flex flex-col items-center justify-center" onClick={onClose}>
            <div className="relative w-full h-full" onClick={e => e.stopPropagation()}>
                <video ref={videoRef} autoPlay playsInline className={`w-full h-full object-cover ${isPreview ? 'hidden' : ''}`}></video>
                <canvas ref={canvasRef} className={`w-full h-full object-contain ${isPreview ? '' : 'hidden'}`}></canvas>
                
                {!isPreview && (
                    <div className="absolute inset-0 pointer-events-none border-[1rem] sm:border-[2rem] border-black/50">
                        <div className="absolute top-4 left-4 sm:top-8 sm:left-8 border-t-4 border-l-4 border-white h-12 w-12 sm:h-16 sm:w-16 opacity-75 rounded-tl-lg"></div>
                        <div className="absolute top-4 right-4 sm:top-8 sm:right-8 border-t-4 border-r-4 border-white h-12 w-12 sm:h-16 sm:w-16 opacity-75 rounded-tr-lg"></div>
                        <div className="absolute bottom-4 left-4 sm:bottom-8 sm:left-8 border-b-4 border-l-4 border-white h-12 w-12 sm:h-16 sm:w-16 opacity-75 rounded-bl-lg"></div>
                        <div className="absolute bottom-4 right-4 sm:bottom-8 sm:right-8 border-b-4 border-r-4 border-white h-12 w-12 sm:h-16 sm:w-16 opacity-75 rounded-br-lg"></div>
                    </div>
                )}

                {(isLoading || error) && 
                    <div className="absolute inset-0 flex items-center justify-center bg-black/70">
                        {isLoading && <ArrowPathIcon className="w-12 h-12 text-white animate-spin" />}
                        {error && <p className="text-white text-center p-8 max-w-sm">{error}</p>}
                    </div>
                }
                
                <button onClick={onClose} className="absolute top-4 right-4 p-3 bg-black/50 rounded-full text-white hover:bg-black/75 transition-colors z-10">
                    <XMarkIcon className="w-6 h-6" />
                </button>

                <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent flex justify-center items-center">
                    {isPreview ? (
                        <div className="flex items-center justify-around w-full max-w-xs">
                             <button onClick={handleRetake} className="flex flex-col items-center text-white font-semibold p-2 rounded-lg hover:bg-white/10">
                                <ArrowPathIcon className="w-8 h-8 mb-1"/>
                                <span>إعادة</span>
                            </button>
                             <button onClick={handleSave} className="w-20 h-20 rounded-full bg-blue-500 flex items-center justify-center p-1 ring-4 ring-black/30 hover:bg-blue-600" aria-label="حفظ الصورة">
                                <CheckCircleIcon className="w-12 h-12 text-white"/>
                            </button>
                        </div>
                    ) : (
                        <button onClick={handleCapture} disabled={isLoading} className="w-20 h-20 rounded-full bg-white flex items-center justify-center p-1 ring-4 ring-black/30 disabled:opacity-50" aria-label="التقاط صورة">
                            <div className="w-full h-full rounded-full bg-white border-2 border-black"></div>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};


const CaseDocuments: React.FC<CaseDocumentsProps> = ({ caseId }) => {
    const { documents, addDocuments, deleteDocument, getDocumentFile } = useData();
    const [isDeleteModalOpen, setIsDeleteModalOpen] = React.useState(false);
    const [docToDelete, setDocToDelete] = React.useState<CaseDocument | null>(null);
    const [previewDoc, setPreviewDoc] = React.useState<CaseDocument | null>(null);
    const [isDragging, setIsDragging] = React.useState(false);
    const [isCameraOpen, setIsCameraOpen] = React.useState(false);

    const caseDocuments = React.useMemo(() => 
        documents
            .filter(doc => doc.caseId === caseId)
            .sort((a,b) => {
                const dateA = a.addedAt instanceof Date ? a.addedAt : new Date(a.addedAt);
                const dateB = b.addedAt instanceof Date ? b.addedAt : new Date(b.addedAt);
                return dateB.getTime() - dateA.getTime();
            }), 
        [documents, caseId]
    );

    const handleFileChange = async (files: FileList | null) => {
        if (files && files.length > 0) {
            try {
                await addDocuments(caseId, files);
            } catch (err: any) {
                alert(`فشل في إضافة الوثائق: ${err.message}`);
            }
        }
    };
    
    const handleDragEvents = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setIsDragging(true);
        } else if (e.type === 'dragleave') {
            setIsDragging(false);
        }
    };
    
    const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            await handleFileChange(e.dataTransfer.files);
        }
    };

    const openDeleteModal = (doc: CaseDocument) => {
        setDocToDelete(doc);
        setIsDeleteModalOpen(true);
    };

    const confirmDelete = async () => {
        if (docToDelete) {
            try {
                await deleteDocument(docToDelete);
            } catch (err: any) {
                alert(`فشل في حذف الوثيقة: ${err.message}`);
            }
        }
        setIsDeleteModalOpen(false);
        setDocToDelete(null);
    };

    const handlePhotoCapture = async (file: File) => {
        const fileList = new DataTransfer();
        fileList.items.add(file);
        try {
            await addDocuments(caseId, fileList.files);
        } catch (err: any) {
            alert(`فشل في إضافة الوثيقة الملتقطة: ${err.message}`);
        }
        setIsCameraOpen(false);
    };
    
    const handlePreview = async (doc: CaseDocument) => {
        if (doc.type === 'application/pdf') {
            const file = await getDocumentFile(doc.id);
            if (file) {
                const url = URL.createObjectURL(file);
                window.open(url, '_blank');
            } else {
                setPreviewDoc(doc); // Let the modal handle the error/missing state display
            }
        } else {
            setPreviewDoc(doc);
        }
    };

    return (
        <div className="space-y-4">
            {/* Upload Area */}
            <div className="flex flex-col sm:flex-row gap-4">
                 <input type="file" id={`file-upload-${caseId}`} multiple className="hidden" onChange={(e) => handleFileChange(e.target.files)} />
                 <div 
                    onDragEnter={handleDragEvents}
                    onDragLeave={handleDragEvents}
                    onDragOver={handleDragEvents}
                    onDrop={handleDrop}
                    className="flex-grow"
                 >
                    <label 
                        htmlFor={`file-upload-${caseId}`} 
                        className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-xl cursor-pointer hover:bg-gray-50 transition-colors h-full ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}`}
                    >
                        <DocumentArrowUpIcon className="w-10 h-10 text-gray-400 mb-2" />
                        <span className="font-semibold text-gray-700">اضغط لرفع الوثائق أو اسحبها هنا</span>
                        <p className="text-xs text-gray-500">سيتم حفظها محلياً وحذفها من السحابة بعد 24 ساعة</p>
                    </label>
                </div>
                <button
                    onClick={() => setIsCameraOpen(true)}
                    className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors"
                >
                    <CameraIcon className="w-10 h-10 text-gray-400 mb-2" />
                    <span className="font-semibold text-gray-700">التقاط وثيقة</span>
                    <p className="text-xs text-gray-500">مسح ضوئي سريع</p>
                </button>
            </div>
            
            {/* Gallery Grid */}
            {caseDocuments.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {caseDocuments.map(doc => (
                        <FilePreview key={doc.id} doc={doc} onPreview={handlePreview} onDelete={openDeleteModal} />
                    ))}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-12 text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                    <DocumentTextIcon className="w-12 h-12 mb-2 opacity-50" />
                    <p>لا توجد وثائق محفوظة لهذه القضية بعد.</p>
                </div>
            )}

            {isDeleteModalOpen && docToDelete && (
                 <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setIsDeleteModalOpen(false)}>
                    <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
                        <div className="text-center">
                            <ExclamationTriangleIcon className="w-12 h-12 text-red-500 mx-auto mb-4" />
                            <h3 className="text-lg font-bold mb-2">تأكيد الحذف</h3>
                            <p className="text-gray-600 mb-6">هل أنت متأكد من حذف المستند "{docToDelete.name}"؟</p>
                            <div className="flex justify-center gap-4">
                                <button onClick={() => setIsDeleteModalOpen(false)} className="px-4 py-2 bg-gray-200 rounded">إلغاء</button>
                                <button onClick={confirmDelete} className="px-4 py-2 bg-red-600 text-white rounded">حذف</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {previewDoc && (
                <PreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />
            )}

            {isCameraOpen && (
                <DocumentScannerModal onClose={() => setIsCameraOpen(false)} onCapture={handlePhotoCapture} />
            )}
        </div>
    );
};

export default CaseDocuments;
