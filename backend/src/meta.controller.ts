import { Controller, Get } from '@nestjs/common';
import { AFAR_WOREDAS } from './common/woredas';

@Controller('meta')
export class MetaController {
  @Get('woredas') woredas() { return AFAR_WOREDAS; }
}
