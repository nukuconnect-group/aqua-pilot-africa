import React from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Download, FileSpreadsheet, FileText, Printer } from 'lucide-react';
import { 
  ExportOptions, 
  exportToCSV, 
  exportToExcel, 
  exportToWord, 
  exportToPDF 
} from '@/lib/dataExportUtils';
import { useSettings } from '@/contexts/SettingsContext';
import { tr } from '@/i18n/runtime';

interface ExportDropdownProps {
  options: ExportOptions;
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  label?: string;
  className?: string;
}

const ExportDropdown = ({ 
  options, 
  variant = 'outline', 
  size = 'sm',
  label = 'Exporter',
  className = ''
}: ExportDropdownProps) => {
  const { language } = useSettings();
  const text = (value: string) => tr(value, language);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size} className={className}>
          <Download className="w-4 h-4 mr-2" />
          {text(label)}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={() => exportToPDF(options)}>
          <Printer className="w-4 h-4 mr-2 text-red-500" />
          {text('Exporter en PDF')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => exportToWord(options)}>
          <FileText className="w-4 h-4 mr-2 text-blue-500" />
          {text('Exporter en Word')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => exportToExcel(options)}>
          <FileSpreadsheet className="w-4 h-4 mr-2 text-green-500" />
          {text('Exporter en Excel')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => exportToCSV(options)}>
          <FileSpreadsheet className="w-4 h-4 mr-2 text-gray-500" />
          {text('Exporter en CSV')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ExportDropdown;
