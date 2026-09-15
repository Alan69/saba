import { Module } from '@nestjs/common';
import { BoxesController, BoxesService } from './boxes';
import { ServicesController, ServicesService } from './services';
import { EmployeesController, EmployeesService } from './employees';

@Module({
  controllers: [BoxesController, ServicesController, EmployeesController],
  providers: [BoxesService, ServicesService, EmployeesService],
  exports: [BoxesService, ServicesService, EmployeesService],
})
export class CatalogModule {}
