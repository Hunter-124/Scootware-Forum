import React, { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import getCroppedImg from '@/lib/cropImage';

interface ImageCropperProps {
  image: string;
  onCropComplete: (croppedImage: Blob) => void;
  onCancel: () => void;
}

export const ImageCropper: React.FC<ImageCropperProps> = ({ image, onCropComplete, onCancel }) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);

  const onCropChange = (crop: { x: number; y: number }) => {
    setCrop(crop);
  };

  const onZoomChange = (zoom: number) => {
    setZoom(zoom);
  };

  const onCropCompleteInternal = useCallback((_croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleSave = async () => {
    try {
      if (!croppedAreaPixels) return;
      const croppedImage = await getCroppedImg(image, croppedAreaPixels);
      onCropComplete(croppedImage);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <Dialog open={!!image} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-md bg-[#111] border-white/10 text-white p-0 overflow-hidden rounded-3xl">
        <div className="p-6 pb-0">
          <DialogHeader>
            <DialogTitle className="text-xl font-display font-bold text-white tracking-tight">Crop Profile Picture</DialogTitle>
          </DialogHeader>
        </div>
        
        <div className="p-6 space-y-6">
          <div className="relative w-full aspect-square bg-black/60 rounded-2xl overflow-hidden border border-white/5 box-glow shadow-inner">
            <Cropper
              image={image}
              crop={crop}
              zoom={zoom}
              aspect={1}
              onCropChange={onCropChange}
              onZoomChange={onZoomChange}
              onCropComplete={onCropCompleteInternal}
              cropShape="round"
              showGrid={false}
              style={{
                containerStyle: { background: 'transparent' },
                cropAreaStyle: { border: '2px solid rgba(255, 255, 255, 0.5)', boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.6)' }
              }}
            />
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                className="text-xs text-white"
                onClick={() => {
                  setCrop({ x: 0, y: 0 });
                }}
              >
                Center
              </Button>
              <Button
                variant="outline"
                className="text-xs text-white"
                onClick={() => {
                  setCrop({ x: 0, y: 0 });
                  setZoom(1);
                }}
              >
                Reset
              </Button>
            </div>

            <div className="flex items-center gap-4 px-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground shrink-0 w-12">Zoom</span>
              <Slider
                value={[zoom]}
                min={1}
                max={4}
                step={0.1}
                onValueChange={(vals) => setZoom(vals[0])}
                className="flex-1"
              />
              <span className="text-xs text-muted-foreground">{zoom.toFixed(1)}x</span>
            </div>

          </div>
        </div>

        <div className="p-6 pt-2 bg-white/5 border-t border-white/5">
          <DialogFooter className="flex sm:flex-row flex-col gap-2">
            <Button 
                variant="ghost" 
                onClick={onCancel} 
                className="flex-1 text-white hover:bg-white/5 border border-white/10 rounded-xl"
            >
              Cancel
            </Button>
            <Button 
                onClick={handleSave} 
                variant="secondary" 
                className="flex-1 shadow-lg shadow-primary/20 rounded-xl font-bold"
            >
              Apply Crop
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
};
