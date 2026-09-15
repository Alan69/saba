import { Module } from '@nestjs/common';
import { ClientController } from './client.controller';
import { ClientService } from './client.service';
import { ClientGuard } from './client.guard';

@Module({
  controllers: [ClientController],
  providers: [ClientService, ClientGuard],
})
export class ClientModule {}
