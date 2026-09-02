import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { QrCode, Printer, ShieldCheck, Tag } from 'lucide-react';
import { Modal } from './Modal';
import { StatusBadge } from './StatusBadge';

export const EquipmentQRModal = ({ isOpen, onClose, equipment }) => {
  if (!equipment) return null;

  const qrValue = equipment.equipment_id || equipment.equipment_code || '';

  const handlePrint = () => {
    window.print();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Caterpillar Asset QR Tag: ${qrValue}`}
      maxWidth="max-w-md"
    >
      <div className="flex flex-col items-center justify-center p-4 text-center space-y-5">
        {/* Machine Header */}
        <div className="w-full p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-cat-500 uppercase tracking-widest flex items-center gap-1">
              <Tag className="w-3.5 h-3.5" />
              {qrValue}
            </span>
            {equipment.status && <StatusBadge status={equipment.status} />}
          </div>
          <h4 className="text-base font-extrabold text-white text-left mt-1">
            {equipment.model || equipment.equipment_model || 'CAT Heavy Equipment'}
          </h4>
          <p className="text-xs text-slate-400 font-mono text-left">
            {equipment.equipment_type || 'Machinery Asset'}
          </p>
        </div>

        {/* High-Contrast Scannable Vector QR Code */}
        <div className="p-5 bg-white rounded-2xl shadow-2xl border-4 border-cat-500 flex flex-col items-center justify-center space-y-2">
          <QRCodeSVG
            value={qrValue}
            size={220}
            bgColor="#FFFFFF"
            fgColor="#000000"
            level="H"
            includeMargin={true}
          />
          <div className="w-full text-center border-t border-slate-200 pt-2">
            <span className="font-mono text-xs text-slate-900 font-extrabold tracking-widest uppercase">
              {qrValue}
            </span>
          </div>
        </div>

        {/* Instruction Note */}
        <div className="w-full p-3 bg-slate-900/60 border border-slate-800 rounded-xl text-xs text-slate-300 font-mono space-y-1">
          <p className="flex items-center justify-center gap-1.5 text-cat-500 font-bold">
            <ShieldCheck className="w-4 h-4" />
            Official Caterpillar Telematics Equipment Tag
          </p>
          <p className="text-[11px] text-slate-400">
            Scan this QR code with any smartphone camera or in-app scanner for instant identification & check-in/check-out.
          </p>
        </div>

        {/* Action Button */}
        <button
          onClick={handlePrint}
          className="flex items-center justify-center gap-2 w-full py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-extrabold text-xs uppercase tracking-wider rounded-xl transition"
        >
          <Printer className="w-4 h-4 text-cat-500" />
          Print / Save Asset Tag
        </button>
      </div>
    </Modal>
  );
};
