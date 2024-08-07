import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsNumberString,
  IsOptional,
  IsBoolean,
  Matches,
  ValidateIf,
} from '@nestjs/class-validator';
import { EVENT_DISTANCES_TYPE } from '../enum/event-distances-type.enum';
import { Transform } from 'class-transformer';
export class EventInputDto {
  @ApiProperty({
    required: false,
    description: '模糊查詢賽事名稱(eventName)或賽事地點(location)。',
    type: String,
  })
  @IsOptional()
  keywords?: string;
  @ApiProperty({
    required: false,
    description:
      "查詢特定賽事日期(eventDate)範圍。 ex: ['2020-01-01'] (該日期及該日期以後舉辦的賽事) or ['2020-01-01', '2020-01-02'] (該日期範圍舉辦的賽事)",
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @Matches(/^\d{4}(-)(((0)[0-9])|((1)[0-2]))(-)([0-2][0-9]|(3)[0-1])$/i, {
    each: true,
    message: 'date must be formatted as yyyy-mm-dd',
  })
  dateRange?: string[];
  @ApiProperty({
    required: false,
    description:
      '可查詢包含一項或多項特定距離的賽事(array of string)。 - MARATHON: 查詢distance >= 42 and < 43 的賽事, HALF_MARATHON: 查詢distance > 21 and <= 22的賽事, TEN_K: 查詢distance === 10的賽事 (賽事距離單位為km)',
    type: [EVENT_DISTANCES_TYPE],
  })
  @IsOptional()
  @IsArray()
  @IsEnum(EVENT_DISTANCES_TYPE, { each: true })
  distances?: EVENT_DISTANCES_TYPE[];
  @ApiProperty({
    required: false,
    description: '目前開放報名的賽事(只有true的條件才會查詢)',
    type: Boolean,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  onlyRegistering?: boolean;
  @ApiProperty({
    required: false,
    description: '是否截止報名',
    type: Boolean,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true')
  entryIsEnd?: boolean;
  @ApiProperty({
    required: false,
    description: '略過筆數(搭配limit使用)',
    type: Number,
  })
  @ValidateIf((o) => o.hasOwnProperty('limit'))
  @IsNumberString()
  offset?: number;
  @ApiProperty({
    required: false,
    description: '筆數(搭配offset使用)',
    type: Number,
  })
  @ValidateIf((o) => o.hasOwnProperty('offset'))
  @IsNumberString()
  limit?: number;

  @ApiProperty({
    required: false,
    description:
      '查詢特定賽事建立時間範圍。 ISO 8601 格式 ex: ["2024/01/01 00:00:00", "2024/01/02 23:59:59"]',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @Matches(/^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}$/i, {
    each: true,
    message: 'createdAtTimes must be formatted as yyyy/mm/dd hh:mm:ss',
  })
  createdAtTimes?: string[];

  @ApiProperty({
    required: false,
    description:
      "查詢特定報名開始時間範圍。 格式 ex: ['2024-01-01'] (該日期及該日期以後開始報名的賽事) or ['2024-01-01', '2024-01-02'] (該日期範圍開始報名的賽事)",
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @Matches(/^\d{4}(-)(((0)[0-9])|((1)[0-2]))(-)([0-2][0-9]|(3)[0-1])$/i, {
    each: true,
    message: 'entryStartDates must be formatted as yyyy-mm-dd',
  })
  entryStartDates?: string[];

  @ApiProperty({
    required: false,
    description:
      "查詢特定報名截止時間範圍。 格式 ex: ['2024-01-01'] (該日期及該日期以後截止報名的賽事) or ['2024-01-01', '2024-01-02'] (該日期範圍截止報名的賽事)",
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @Matches(/^\d{4}(-)(((0)[0-9])|((1)[0-2]))(-)([0-2][0-9]|(3)[0-1])$/i, {
    each: true,
    message: 'entryEndDates must be formatted as yyyy-mm-dd',
  })
  entryEndDates?: string[];

  @ApiProperty({
    required: false,
    description:
      '排序欄位(僅支援eventDate, entryStartDate, entryEndDate)。預設為eventDate',
    type: String,
  })
  @IsOptional()
  @IsEnum(['eventDate', 'entryStartDate', 'entryEndDate'])
  sortBy = 'eventDate';

  @ApiProperty({
    required: false,
    description: '排序方式(asc, desc)。預設為asc',
    type: String,
  })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  orderBy = 'asc';
}
