import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CreateSubcategoryDto } from './dto/create-subcategory.dto';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  // Categories
  @Post()
  createCategory(@Body() createCategoryDto: CreateCategoryDto) {
    return this.categoriesService.createCategory(createCategoryDto);
  }

  @Get()
  findAllCategories() {
    return this.categoriesService.findAllCategories();
  }

  @Get(':id')
  findOneCategory(@Param('id') id: string) {
    return this.categoriesService.findOneCategory(id);
  }

  @Patch(':id')
  updateCategory(
    @Param('id') id: string,
    @Body() updateData: Partial<CreateCategoryDto>,
  ) {
    return this.categoriesService.updateCategory(id, updateData);
  }

  @Delete(':id')
  removeCategory(@Param('id') id: string) {
    return this.categoriesService.removeCategory(id);
  }

  // Subcategories
  @Post('subcategories')
  createSubcategory(@Body() createSubcategoryDto: CreateSubcategoryDto) {
    return this.categoriesService.createSubcategory(createSubcategoryDto);
  }

  @Get('subcategories/all')
  findAllSubcategories() {
    return this.categoriesService.findAllSubcategories();
  }

  @Get('subcategories/category/:categoryId')
  findSubcategoriesByCategory(@Param('categoryId') categoryId: string) {
    return this.categoriesService.findAllSubcategories(categoryId);
  }

  @Get('subcategories/:id')
  findOneSubcategory(@Param('id') id: string) {
    return this.categoriesService.findOneSubcategory(id);
  }

  @Patch('subcategories/:id')
  updateSubcategory(
    @Param('id') id: string,
    @Body() updateData: Partial<CreateSubcategoryDto>,
  ) {
    return this.categoriesService.updateSubcategory(id, updateData);
  }

  @Delete('subcategories/:id')
  removeSubcategory(@Param('id') id: string) {
    return this.categoriesService.removeSubcategory(id);
  }
}

