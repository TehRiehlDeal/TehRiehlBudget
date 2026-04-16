import { ArrayMinSize, IsArray, IsUUID } from 'class-validator';

export class ReorderAccountsDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('all', { each: true })
  orderedIds: string[];
}
