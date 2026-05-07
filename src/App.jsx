import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Upload, Download, Sparkles, Settings, Grid3x3, Printer, Palette, Image as ImageIcon, Loader2 } from 'lucide-react';

// === DMC Color Palette ===
// Curated list of common DMC floss colors with RGB values.
// Each diamond painting kit uses DMC numbers as the universal standard.
const DMC_COLORS = [
  { code: 'B5200', name: 'Snow White', r: 255, g: 255, b: 255 },
  { code: '1', name: 'White Tin', r: 227, g: 227, b: 227 },
  { code: '310', name: 'Black', r: 0, g: 0, b: 0 },
  { code: '413', name: 'Pewter Gray Dk', r: 109, g: 110, b: 113 },
  { code: '414', name: 'Steel Gray Dk', r: 140, g: 140, b: 140 },
  { code: '415', name: 'Pearl Gray', r: 211, g: 211, b: 214 },
  { code: '317', name: 'Pewter Gray', r: 167, g: 168, b: 169 },
  { code: '318', name: 'Steel Gray Lt', r: 171, g: 171, b: 171 },
  { code: '535', name: 'Ash Gray Vy Lt', r: 99, g: 100, b: 88 },
  { code: '844', name: 'Beaver Gray Ult Dk', r: 72, g: 72, b: 72 },
  { code: '321', name: 'Red', r: 199, g: 43, b: 59 },
  { code: '498', name: 'Red Dk', r: 167, g: 19, b: 43 },
  { code: '304', name: 'Red Med', r: 183, g: 31, b: 51 },
  { code: '816', name: 'Garnet', r: 151, g: 27, b: 47 },
  { code: '817', name: 'Coral Red Vy Dk', r: 219, g: 36, b: 53 },
  { code: '666', name: 'Christmas Red Br', r: 227, g: 29, b: 66 },
  { code: '349', name: 'Coral Dk', r: 210, g: 16, b: 53 },
  { code: '350', name: 'Coral Med', r: 224, g: 72, b: 86 },
  { code: '351', name: 'Coral', r: 233, g: 106, b: 103 },
  { code: '352', name: 'Coral Lt', r: 253, g: 156, b: 151 },
  { code: '353', name: 'Peach', r: 254, g: 215, b: 204 },
  { code: '760', name: 'Salmon', r: 245, g: 173, b: 173 },
  { code: '761', name: 'Salmon Lt', r: 255, g: 201, b: 201 },
  { code: '3801', name: 'Melon Vy Dk', r: 231, g: 73, b: 103 },
  { code: '3705', name: 'Melon Dk', r: 255, g: 81, b: 108 },
  { code: '3706', name: 'Melon Med', r: 255, g: 173, b: 188 },
  { code: '3712', name: 'Salmon Med', r: 241, g: 135, b: 135 },
  { code: '3713', name: 'Salmon Vy Lt', r: 255, g: 226, b: 226 },
  { code: '600', name: 'Cranberry Vy Dk', r: 205, g: 47, b: 99 },
  { code: '601', name: 'Cranberry Dk', r: 209, g: 40, b: 106 },
  { code: '602', name: 'Cranberry Med', r: 226, g: 72, b: 116 },
  { code: '603', name: 'Cranberry', r: 255, g: 164, b: 190 },
  { code: '604', name: 'Cranberry Lt', r: 255, g: 176, b: 190 },
  { code: '605', name: 'Cranberry Vy Lt', r: 255, g: 192, b: 205 },
  { code: '892', name: 'Carnation Med', r: 255, g: 124, b: 140 },
  { code: '893', name: 'Carnation Lt', r: 252, g: 144, b: 162 },
  { code: '894', name: 'Carnation Vy Lt', r: 255, g: 178, b: 187 },
  { code: '895', name: 'Hunter Green Vy Dk', r: 89, g: 92, b: 30 },
  { code: '326', name: 'Rose Vy Dp', r: 179, g: 59, b: 75 },
  { code: '335', name: 'Rose', r: 238, g: 84, b: 110 },
  { code: '899', name: 'Rose Med', r: 242, g: 118, b: 136 },
  { code: '3326', name: 'Rose Lt', r: 251, g: 173, b: 180 },
  { code: '776', name: 'Pink Med', r: 252, g: 176, b: 185 },
  { code: '818', name: 'Baby Pink', r: 255, g: 223, b: 217 },
  { code: '819', name: 'Baby Pink Lt', r: 255, g: 238, b: 235 },
  { code: '3713', name: 'Salmon Vy Lt', r: 255, g: 226, b: 226 },
  { code: '3716', name: 'Dusty Rose Med Vy Lt', r: 255, g: 189, b: 200 },
  { code: '961', name: 'Dusty Rose Dk', r: 207, g: 92, b: 117 },
  { code: '962', name: 'Dusty Rose Med', r: 253, g: 134, b: 141 },
  { code: '963', name: 'Dusty Rose Ul Vy Lt', r: 255, g: 215, b: 215 },
  { code: '309', name: 'Rose Dk', r: 195, g: 35, b: 84 },
  { code: '3350', name: 'Dusty Rose Ul Dk', r: 192, g: 47, b: 100 },
  { code: '3354', name: 'Dusty Rose Lt', r: 228, g: 166, b: 172 },
  { code: '600', name: 'Cranberry Vy Dk', r: 205, g: 47, b: 99 },
  { code: '718', name: 'Plum', r: 156, g: 36, b: 98 },
  { code: '917', name: 'Plum Med', r: 155, g: 19, b: 89 },
  { code: '915', name: 'Plum Dk', r: 130, g: 0, b: 67 },
  { code: '3607', name: 'Plum Lt', r: 197, g: 73, b: 137 },
  { code: '3608', name: 'Plum Vy Lt', r: 234, g: 156, b: 196 },
  { code: '3609', name: 'Plum Ul Lt', r: 244, g: 179, b: 215 },
  { code: '208', name: 'Lavender Vy Dk', r: 131, g: 91, b: 139 },
  { code: '209', name: 'Lavender Dk', r: 163, g: 123, b: 167 },
  { code: '210', name: 'Lavender Med', r: 195, g: 159, b: 195 },
  { code: '211', name: 'Lavender Lt', r: 227, g: 203, b: 227 },
  { code: '550', name: 'Violet Vy Dk', r: 92, g: 24, b: 78 },
  { code: '552', name: 'Violet Med', r: 128, g: 58, b: 107 },
  { code: '553', name: 'Violet', r: 163, g: 99, b: 139 },
  { code: '554', name: 'Violet Lt', r: 219, g: 179, b: 203 },
  { code: '327', name: 'Violet Dk', r: 99, g: 54, b: 102 },
  { code: '333', name: 'Blue Violet Vy Dk', r: 92, g: 84, b: 120 },
  { code: '340', name: 'Blue Violet Med', r: 173, g: 167, b: 199 },
  { code: '341', name: 'Blue Violet Lt', r: 183, g: 191, b: 221 },
  { code: '155', name: 'Blue Violet Med Dk', r: 152, g: 145, b: 182 },
  { code: '156', name: 'Blue Violet Med Lt', r: 163, g: 174, b: 209 },
  { code: '157', name: 'Cornflower Blue Vy Lt', r: 187, g: 195, b: 217 },
  { code: '158', name: 'Cornflower Blue Med Vy Dk', r: 76, g: 82, b: 110 },
  { code: '159', name: 'Gray Blue Lt', r: 199, g: 202, b: 215 },
  { code: '160', name: 'Gray Blue Med', r: 153, g: 159, b: 183 },
  { code: '161', name: 'Gray Blue', r: 120, g: 128, b: 164 },
  { code: '792', name: 'Cornflower Blue Dk', r: 97, g: 100, b: 137 },
  { code: '793', name: 'Cornflower Blue Med', r: 138, g: 142, b: 173 },
  { code: '794', name: 'Cornflower Blue Lt', r: 175, g: 187, b: 213 },
  { code: '796', name: 'Royal Blue Dk', r: 17, g: 65, b: 109 },
  { code: '797', name: 'Royal Blue', r: 19, g: 71, b: 125 },
  { code: '798', name: 'Delft Blue Dk', r: 70, g: 106, b: 142 },
  { code: '799', name: 'Delft Blue Med', r: 116, g: 142, b: 182 },
  { code: '800', name: 'Delft Blue Pale', r: 192, g: 204, b: 222 },
  { code: '820', name: 'Royal Blue Vy Dk', r: 14, g: 54, b: 92 },
  { code: '824', name: 'Blue Vy Dk', r: 57, g: 105, b: 172 },
  { code: '825', name: 'Blue Dk', r: 71, g: 129, b: 165 },
  { code: '826', name: 'Blue Med', r: 107, g: 158, b: 191 },
  { code: '827', name: 'Blue Vy Lt', r: 189, g: 221, b: 237 },
  { code: '311', name: 'Navy Blue Med', r: 28, g: 80, b: 102 },
  { code: '312', name: 'Navy Blue Lt', r: 58, g: 96, b: 130 },
  { code: '322', name: 'Baby Blue Dk', r: 119, g: 151, b: 178 },
  { code: '334', name: 'Baby Blue Med', r: 115, g: 159, b: 193 },
  { code: '336', name: 'Navy Blue', r: 36, g: 73, b: 103 },
  { code: '775', name: 'Baby Blue Vy Lt', r: 217, g: 235, b: 241 },
  { code: '3325', name: 'Baby Blue Lt', r: 184, g: 210, b: 230 },
  { code: '3753', name: 'Antique Blue Ul Vy Lt', r: 219, g: 226, b: 233 },
  { code: '3755', name: 'Baby Blue', r: 147, g: 180, b: 206 },
  { code: '3756', name: 'Baby Blue Ul Vy Lt', r: 238, g: 252, b: 252 },
  { code: '517', name: 'Wedgewood Dk', r: 63, g: 130, b: 159 },
  { code: '518', name: 'Wedgewood Lt', r: 97, g: 153, b: 183 },
  { code: '519', name: 'Sky Blue', r: 126, g: 177, b: 200 },
  { code: '3760', name: 'Wedgewood Med', r: 62, g: 133, b: 162 },
  { code: '3761', name: 'Sky Blue Lt', r: 172, g: 211, b: 222 },
  { code: '3765', name: 'Peacock Blue Vy Dk', r: 36, g: 110, b: 130 },
  { code: '3766', name: 'Peacock Blue Lt', r: 80, g: 158, b: 181 },
  { code: '3768', name: 'Gray Green Dk', r: 101, g: 126, b: 130 },
  { code: '807', name: 'Peacock Blue', r: 100, g: 171, b: 186 },
  { code: '813', name: 'Blue Lt', r: 161, g: 194, b: 215 },
  { code: '809', name: 'Delft Blue', r: 148, g: 168, b: 198 },
  { code: '3838', name: 'Lavender Blue Dk', r: 92, g: 114, b: 148 },
  { code: '3839', name: 'Lavender Blue Med', r: 123, g: 142, b: 171 },
  { code: '3840', name: 'Lavender Blue Lt', r: 176, g: 192, b: 218 },
  { code: '747', name: 'Sky Blue Vy Lt', r: 229, g: 252, b: 253 },
  { code: '3811', name: 'Turquoise Vy Lt', r: 188, g: 227, b: 230 },
  { code: '598', name: 'Turquoise Lt', r: 144, g: 195, b: 204 },
  { code: '597', name: 'Turquoise', r: 91, g: 163, b: 179 },
  { code: '3810', name: 'Turquoise Dk', r: 27, g: 157, b: 182 },
  { code: '3812', name: 'Sea Green Vy Dk', r: 73, g: 144, b: 151 },
  { code: '3848', name: 'Teal Green Med', r: 84, g: 140, b: 137 },
  { code: '3849', name: 'Teal Green Lt', r: 99, g: 169, b: 152 },
  { code: '3850', name: 'Bright Green Dk', r: 55, g: 132, b: 119 },
  { code: '959', name: 'Sea Green Med', r: 142, g: 209, b: 188 },
  { code: '964', name: 'Sea Green Lt', r: 169, g: 226, b: 216 },
  { code: '958', name: 'Sea Green Dk', r: 62, g: 182, b: 161 },
  { code: '991', name: 'Aquamarine Dk', r: 71, g: 129, b: 114 },
  { code: '992', name: 'Aquamarine Lt', r: 111, g: 174, b: 159 },
  { code: '993', name: 'Aquamarine Vy Lt', r: 144, g: 192, b: 180 },
  { code: '3814', name: 'Aquamarine', r: 80, g: 139, b: 125 },
  { code: '500', name: 'Blue Green Vy Dk', r: 4, g: 77, b: 51 },
  { code: '501', name: 'Blue Green Dk', r: 27, g: 101, b: 81 },
  { code: '502', name: 'Blue Green', r: 91, g: 144, b: 113 },
  { code: '503', name: 'Blue Green Med', r: 123, g: 172, b: 148 },
  { code: '504', name: 'Blue Green Vy Lt', r: 196, g: 222, b: 204 },
  { code: '561', name: 'Jade Vy Dk', r: 59, g: 96, b: 76 },
  { code: '562', name: 'Jade Med', r: 80, g: 139, b: 95 },
  { code: '563', name: 'Jade Lt', r: 143, g: 198, b: 144 },
  { code: '564', name: 'Jade Vy Lt', r: 167, g: 219, b: 180 },
  { code: '699', name: 'Christmas Green', r: 5, g: 101, b: 23 },
  { code: '700', name: 'Christmas Green Br', r: 7, g: 115, b: 27 },
  { code: '701', name: 'Christmas Green Lt', r: 63, g: 143, b: 41 },
  { code: '702', name: 'Kelly Green', r: 71, g: 167, b: 47 },
  { code: '703', name: 'Chartreuse', r: 123, g: 181, b: 71 },
  { code: '704', name: 'Chartreuse Br', r: 158, g: 207, b: 52 },
  { code: '904', name: 'Parrot Green Vy Dk', r: 85, g: 120, b: 34 },
  { code: '905', name: 'Parrot Green Dk', r: 98, g: 138, b: 40 },
  { code: '906', name: 'Parrot Green Med', r: 127, g: 179, b: 53 },
  { code: '907', name: 'Parrot Green Lt', r: 199, g: 230, b: 102 },
  { code: '909', name: 'Emerald Green Vy Dk', r: 21, g: 111, b: 73 },
  { code: '910', name: 'Emerald Green Dk', r: 24, g: 126, b: 86 },
  { code: '911', name: 'Emerald Green Med', r: 24, g: 144, b: 101 },
  { code: '912', name: 'Emerald Green Lt', r: 27, g: 157, b: 105 },
  { code: '913', name: 'Nile Green Med', r: 109, g: 171, b: 119 },
  { code: '954', name: 'Nile Green', r: 136, g: 186, b: 145 },
  { code: '955', name: 'Nile Green Lt', r: 162, g: 214, b: 173 },
  { code: '987', name: 'Forest Green Dk', r: 49, g: 92, b: 48 },
  { code: '988', name: 'Forest Green Med', r: 115, g: 139, b: 55 },
  { code: '989', name: 'Forest Green', r: 141, g: 166, b: 117 },
  { code: '3346', name: 'Hunter Green', r: 64, g: 106, b: 58 },
  { code: '3347', name: 'Yellow Green Med', r: 119, g: 159, b: 79 },
  { code: '3348', name: 'Yellow Green Lt', r: 204, g: 217, b: 138 },
  { code: '3345', name: 'Hunter Green Dk', r: 27, g: 89, b: 21 },
  { code: '3363', name: 'Pine Green Med', r: 114, g: 130, b: 86 },
  { code: '3364', name: 'Pine Green', r: 131, g: 151, b: 95 },
  { code: '472', name: 'Avocado Green Ul Lt', r: 216, g: 228, b: 152 },
  { code: '471', name: 'Avocado Green Vy Lt', r: 174, g: 191, b: 121 },
  { code: '470', name: 'Avocado Green Lt', r: 148, g: 171, b: 79 },
  { code: '469', name: 'Avocado Green', r: 114, g: 132, b: 60 },
  { code: '937', name: 'Avocado Green Med', r: 98, g: 113, b: 51 },
  { code: '936', name: 'Avocado Green Vy Dk', r: 76, g: 88, b: 38 },
  { code: '935', name: 'Avocado Green Dk', r: 66, g: 77, b: 33 },
  { code: '934', name: 'Black Avocado Green', r: 49, g: 57, b: 25 },
  { code: '730', name: 'Olive Green Vy Dk', r: 130, g: 117, b: 23 },
  { code: '731', name: 'Olive Green Dk', r: 147, g: 134, b: 27 },
  { code: '732', name: 'Olive Green', r: 148, g: 140, b: 54 },
  { code: '733', name: 'Olive Green Med', r: 188, g: 178, b: 92 },
  { code: '734', name: 'Olive Green Lt', r: 206, g: 198, b: 132 },
  { code: '676', name: 'Old Gold Lt', r: 229, g: 206, b: 151 },
  { code: '677', name: 'Old Gold Vy Lt', r: 247, g: 228, b: 187 },
  { code: '729', name: 'Old Gold Med', r: 206, g: 169, b: 88 },
  { code: '680', name: 'Old Gold Dk', r: 188, g: 141, b: 14 },
  { code: '3829', name: 'Old Gold Vy Dk', r: 169, g: 130, b: 4 },
  { code: '725', name: 'Topaz', r: 255, g: 200, b: 64 },
  { code: '726', name: 'Topaz Lt', r: 253, g: 215, b: 85 },
  { code: '727', name: 'Topaz Vy Lt', r: 255, g: 241, b: 175 },
  { code: '728', name: 'Topaz Bright', r: 228, g: 180, b: 104 },
  { code: '743', name: 'Yellow Med', r: 254, g: 211, b: 118 },
  { code: '744', name: 'Yellow Pale', r: 255, g: 231, b: 147 },
  { code: '745', name: 'Yellow Pale Lt', r: 255, g: 240, b: 197 },
  { code: '746', name: 'Off White', r: 251, g: 245, b: 222 },
  { code: '973', name: 'Canary Bright', r: 255, g: 227, b: 0 },
  { code: '972', name: 'Canary Dp', r: 255, g: 181, b: 21 },
  { code: '444', name: 'Lemon Dk', r: 255, g: 214, b: 0 },
  { code: '445', name: 'Lemon Lt', r: 255, g: 251, b: 139 },
  { code: '307', name: 'Lemon', r: 254, g: 237, b: 92 },
  { code: '3078', name: 'Golden Yellow Vy Lt', r: 253, g: 249, b: 205 },
  { code: '742', name: 'Tangerine Lt', r: 255, g: 191, b: 87 },
  { code: '741', name: 'Tangerine Med', r: 255, g: 163, b: 43 },
  { code: '740', name: 'Tangerine', r: 255, g: 139, b: 0 },
  { code: '970', name: 'Pumpkin Lt', r: 247, g: 139, b: 19 },
  { code: '971', name: 'Pumpkin', r: 246, g: 127, b: 0 },
  { code: '947', name: 'Burnt Orange', r: 255, g: 123, b: 77 },
  { code: '946', name: 'Burnt Orange Med', r: 235, g: 99, b: 7 },
  { code: '900', name: 'Burnt Orange Dk', r: 209, g: 88, b: 7 },
  { code: '720', name: 'Orange Spice Dk', r: 229, g: 92, b: 31 },
  { code: '721', name: 'Orange Spice Med', r: 242, g: 120, b: 66 },
  { code: '722', name: 'Orange Spice Lt', r: 247, g: 151, b: 111 },
  { code: '3825', name: 'Pumpkin Pale', r: 253, g: 189, b: 150 },
  { code: '3826', name: 'Golden Brown', r: 173, g: 114, b: 57 },
  { code: '3827', name: 'Golden Brown Pale', r: 247, g: 187, b: 119 },
  { code: '3854', name: 'Autumn Gold Med', r: 242, g: 175, b: 104 },
  { code: '3855', name: 'Autumn Gold Lt', r: 250, g: 211, b: 150 },
  { code: '3856', name: 'Mahogany Ul Vy Lt', r: 255, g: 211, b: 181 },
  { code: '301', name: 'Mahogany Med', r: 179, g: 95, b: 43 },
  { code: '400', name: 'Mahogany Dk', r: 142, g: 64, b: 0 },
  { code: '402', name: 'Mahogany Vy Lt', r: 247, g: 167, b: 119 },
  { code: '300', name: 'Mahogany Vy Dk', r: 105, g: 38, b: 13 },
  { code: '3776', name: 'Mahogany Lt', r: 204, g: 113, b: 56 },
  { code: '975', name: 'Golden Brown Dk', r: 145, g: 79, b: 18 },
  { code: '976', name: 'Golden Brown Med', r: 196, g: 124, b: 66 },
  { code: '977', name: 'Golden Brown Lt', r: 219, g: 153, b: 90 },
  { code: '433', name: 'Brown Med', r: 122, g: 69, b: 31 },
  { code: '434', name: 'Brown Lt', r: 152, g: 94, b: 51 },
  { code: '435', name: 'Brown Vy Lt', r: 187, g: 129, b: 65 },
  { code: '436', name: 'Tan', r: 203, g: 154, b: 96 },
  { code: '437', name: 'Tan Lt', r: 228, g: 187, b: 142 },
  { code: '738', name: 'Tan Vy Lt', r: 236, g: 204, b: 158 },
  { code: '739', name: 'Tan Ul Vy Lt', r: 248, g: 228, b: 200 },
  { code: '801', name: 'Coffee Brown Dk', r: 101, g: 57, b: 25 },
  { code: '898', name: 'Coffee Brown Vy Dk', r: 73, g: 42, b: 19 },
  { code: '938', name: 'Coffee Brown Ul Dk', r: 54, g: 31, b: 14 },
  { code: '939', name: 'Navy Blue Vy Dk', r: 27, g: 40, b: 83 },
  { code: '3371', name: 'Black Brown', r: 30, g: 17, b: 8 },
  { code: '3031', name: 'Mocha Brown Vy Dk', r: 75, g: 60, b: 42 },
  { code: '3032', name: 'Mocha Brown Med', r: 154, g: 137, b: 113 },
  { code: '3033', name: 'Mocha Brown Vy Lt', r: 227, g: 216, b: 204 },
  { code: '3782', name: 'Mocha Brown Lt', r: 210, g: 188, b: 166 },
  { code: '3787', name: 'Brown Gray Dk', r: 98, g: 75, b: 69 },
  { code: '3790', name: 'Beige Gray Ul Dk', r: 127, g: 106, b: 85 },
  { code: '3863', name: 'Mocha Beige Med', r: 150, g: 130, b: 102 },
  { code: '3864', name: 'Mocha Beige Lt', r: 188, g: 165, b: 142 },
  { code: '3866', name: 'Mocha Brown Ul Vy Lt', r: 250, g: 246, b: 240 },
  { code: '420', name: 'Hazelnut Brown Dk', r: 152, g: 110, b: 60 },
  { code: '422', name: 'Hazelnut Brown Lt', r: 198, g: 168, b: 121 },
  { code: '407', name: 'Desert Sand Dk', r: 187, g: 139, b: 119 },
  { code: '3771', name: 'Terra Cotta Ul Vy Lt', r: 244, g: 187, b: 169 },
  { code: '3772', name: 'Desert Sand Vy Dk', r: 160, g: 108, b: 82 },
  { code: '3773', name: 'Desert Sand Med', r: 182, g: 117, b: 95 },
  { code: '3774', name: 'Desert Sand Vy Lt', r: 243, g: 225, b: 215 },
  { code: '950', name: 'Desert Sand Lt', r: 238, g: 211, b: 193 },
  { code: '951', name: 'Tawny Lt', r: 255, g: 226, b: 207 },
  { code: '3856', name: 'Mahogany Ul Vy Lt', r: 255, g: 211, b: 181 },
  { code: '3859', name: 'Rosewood Lt', r: 186, g: 140, b: 130 },
  { code: '3860', name: 'Cocoa', r: 125, g: 93, b: 87 },
  { code: '3861', name: 'Cocoa Lt', r: 166, g: 136, b: 129 },
  { code: '3862', name: 'Mocha Beige Dk', r: 138, g: 110, b: 78 },
  { code: '779', name: 'Cocoa Dk', r: 104, g: 77, b: 73 },
  { code: '21', name: 'Light Alizarin', r: 219, g: 145, b: 145 },
  { code: '23', name: 'Apple Blossom', r: 237, g: 174, b: 188 },
  { code: '160', name: 'Gray Blue Med', r: 153, g: 159, b: 183 },
  { code: '162', name: 'Blue Vy Lt', r: 219, g: 235, b: 244 },
  { code: '164', name: 'Forest Green Lt', r: 200, g: 216, b: 184 },
  { code: '166', name: 'Moss Green Med Lt', r: 192, g: 200, b: 64 },
  { code: '168', name: 'Pewter Vy Lt', r: 209, g: 209, b: 209 },
  { code: '169', name: 'Pewter Lt', r: 132, g: 132, b: 132 },
];

// === Color matching using CIE Lab perceptual distance ===
// RGB->Lab conversion gives much better visual matches than raw RGB distance
function rgbToLab(r, g, b) {
  let R = r / 255, G = g / 255, B = b / 255;
  R = R > 0.04045 ? Math.pow((R + 0.055) / 1.055, 2.4) : R / 12.92;
  G = G > 0.04045 ? Math.pow((G + 0.055) / 1.055, 2.4) : G / 12.92;
  B = B > 0.04045 ? Math.pow((B + 0.055) / 1.055, 2.4) : B / 12.92;
  let X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  let Y = (R * 0.2126 + G * 0.7152 + B * 0.0722) / 1.0;
  let Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  X = X > 0.008856 ? Math.pow(X, 1/3) : (7.787 * X) + 16/116;
  Y = Y > 0.008856 ? Math.pow(Y, 1/3) : (7.787 * Y) + 16/116;
  Z = Z > 0.008856 ? Math.pow(Z, 1/3) : (7.787 * Z) + 16/116;
  return [(116 * Y) - 16, 500 * (X - Y), 200 * (Y - Z)];
}

// Pre-compute Lab values for each DMC color
const DMC_LAB = DMC_COLORS.map(c => ({ ...c, lab: rgbToLab(c.r, c.g, c.b) }));

function findNearestDMC(r, g, b, palette = DMC_LAB) {
  const [L, a, bL] = rgbToLab(r, g, b);
  let best = palette[0];
  let bestDist = Infinity;
  for (const c of palette) {
    const dL = L - c.lab[0];
    const da = a - c.lab[1];
    const db = bL - c.lab[2];
    const d = dL*dL + da*da + db*db;
    if (d < bestDist) { bestDist = d; best = c; }
  }
  return best;
}

// === Symbol assignment for printable chart ===
// Numbers and letters only — easy to read, easy to write.
// Skip ambiguous chars: 0/O, 1/I/L, to avoid confusion at small print sizes.
const SYMBOL_POOL = [
  // Single digits first (most common colors get easiest labels)
  '2','3','4','5','6','7','8','9',
  // Then capital letters (skip I, O, L)
  'A','B','C','D','E','F','G','H','J','K','M','N','P','Q','R','S','T','U','V','W','X','Y','Z',
  // Then lowercase (skip i, o, l)
  'a','b','c','d','e','f','g','h','j','k','m','n','p','q','r','s','t','u','v','w','x','y','z',
  // Two-digit numbers if we run out (>57 colors, very rare)
  '10','11','12','13','14','15','16','17','18','19','20','21','22','23','24','25','26','27','28','29','30',
];

export default function DiamondPaintingConverter() {
  const [imageData, setImageData] = useState(null); // {dataUrl, width, height}
  const [canvasWidthIn, setCanvasWidthIn] = useState(12);
  const [canvasHeightIn, setCanvasHeightIn] = useState(12);
  const [drillSizeMm, setDrillSizeMm] = useState(2.5);
  const [maxColors, setMaxColors] = useState(30);
  const [drillShape, setDrillShape] = useState('round'); // 'round' | 'square'
  const [pattern, setPattern] = useState(null); // {grid, palette, gridW, gridH}
  const [processing, setProcessing] = useState(false);
  const [view, setView] = useState('color'); // 'color' | 'symbol' | 'side-by-side'
  const [zoom, setZoom] = useState(1);

  const fileInputRef = useRef(null);
  const previewCanvasRef = useRef(null);
  const symbolCanvasRef = useRef(null);

  // Derived: grid dimensions based on physical sizes
  const MM_PER_IN = 25.4;
  const gridW = Math.max(1, Math.round((canvasWidthIn * MM_PER_IN) / drillSizeMm));
  const gridH = Math.max(1, Math.round((canvasHeightIn * MM_PER_IN) / drillSizeMm));
  const totalDrills = gridW * gridH;

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        setImageData({ dataUrl: ev.target.result, width: img.width, height: img.height });
        setPattern(null);
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  };

  const generatePattern = useCallback(async () => {
    if (!imageData) return;
    setProcessing(true);
    // Yield to UI
    await new Promise(r => setTimeout(r, 50));

    const img = new Image();
    img.src = imageData.dataUrl;
    await new Promise(res => { img.onload = res; });

    // Step 1: downsample image to grid resolution with proper averaging
    const sampler = document.createElement('canvas');
    sampler.width = gridW;
    sampler.height = gridH;
    const sctx = sampler.getContext('2d');
    sctx.imageSmoothingEnabled = true;
    sctx.imageSmoothingQuality = 'high';

    // Maintain aspect ratio by cropping image to grid aspect
    const gridAspect = gridW / gridH;
    const imgAspect = img.width / img.height;
    let sx = 0, sy = 0, sw = img.width, sh = img.height;
    if (imgAspect > gridAspect) {
      sw = img.height * gridAspect;
      sx = (img.width - sw) / 2;
    } else {
      sh = img.width / gridAspect;
      sy = (img.height - sh) / 2;
    }
    sctx.drawImage(img, sx, sy, sw, sh, 0, 0, gridW, gridH);
    const imgData = sctx.getImageData(0, 0, gridW, gridH).data;

    // Step 2: collect all pixels with their initial DMC matches
    const initialMatches = new Map(); // code -> {color, count}
    const pixelMatches = new Array(gridW * gridH);
    for (let i = 0; i < gridW * gridH; i++) {
      const r = imgData[i*4], g = imgData[i*4+1], b = imgData[i*4+2];
      const m = findNearestDMC(r, g, b);
      pixelMatches[i] = m;
      const e = initialMatches.get(m.code);
      if (e) e.count++;
      else initialMatches.set(m.code, { color: m, count: 1 });
    }

    // Step 3: limit to top N colors. Sort by frequency; for less-used colors,
    // remap their pixels to the nearest *kept* DMC color.
    const sorted = [...initialMatches.values()].sort((a, b) => b.count - a.count);
    const kept = sorted.slice(0, maxColors).map(e => e.color);
    const keptLab = kept.map(c => ({ ...c, lab: rgbToLab(c.r, c.g, c.b) }));

    // Step 4: rebuild grid using kept palette
    const grid = new Array(gridW * gridH);
    const finalCounts = new Map();
    for (let i = 0; i < gridW * gridH; i++) {
      const r = imgData[i*4], g = imgData[i*4+1], b = imgData[i*4+2];
      const m = findNearestDMC(r, g, b, keptLab);
      grid[i] = m.code;
      finalCounts.set(m.code, (finalCounts.get(m.code) || 0) + 1);
    }

    // Step 5: build palette with symbol assignments, sorted by count desc
    const palette = kept
      .filter(c => finalCounts.has(c.code))
      .sort((a, b) => (finalCounts.get(b.code) || 0) - (finalCounts.get(a.code) || 0))
      .map((c, i) => ({
        ...c,
        symbol: SYMBOL_POOL[i] || '?',
        count: finalCounts.get(c.code) || 0,
      }));

    setPattern({ grid, palette, gridW, gridH });
    setProcessing(false);
  }, [imageData, gridW, gridH, maxColors]);

  // Render color preview
  useEffect(() => {
    if (!pattern || !previewCanvasRef.current) return;
    const canvas = previewCanvasRef.current;
    const cellPx = 8; // base render size
    canvas.width = pattern.gridW * cellPx;
    canvas.height = pattern.gridH * cellPx;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const codeMap = new Map(pattern.palette.map(p => [p.code, p]));

    for (let y = 0; y < pattern.gridH; y++) {
      for (let x = 0; x < pattern.gridW; x++) {
        const code = pattern.grid[y * pattern.gridW + x];
        const c = codeMap.get(code);
        if (!c) continue;
        ctx.fillStyle = `rgb(${c.r},${c.g},${c.b})`;
        if (drillShape === 'round') {
          ctx.beginPath();
          ctx.arc(x * cellPx + cellPx/2, y * cellPx + cellPx/2, cellPx/2 - 0.3, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillRect(x * cellPx + 0.3, y * cellPx + 0.3, cellPx - 0.6, cellPx - 0.6);
        }
      }
    }
  }, [pattern, drillShape]);

  // Render symbol/chart preview
  useEffect(() => {
    if (!pattern || !symbolCanvasRef.current) return;
    const canvas = symbolCanvasRef.current;
    const cellPx = 22;
    canvas.width = pattern.gridW * cellPx;
    canvas.height = pattern.gridH * cellPx;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const codeMap = new Map(pattern.palette.map(p => [p.code, p]));

    // Light color tint as background per cell so it's still readable but symbol shows
    for (let y = 0; y < pattern.gridH; y++) {
      for (let x = 0; x < pattern.gridW; x++) {
        const code = pattern.grid[y * pattern.gridW + x];
        const c = codeMap.get(code);
        if (!c) continue;
        // tinted background
        ctx.fillStyle = `rgba(${c.r},${c.g},${c.b},0.35)`;
        ctx.fillRect(x * cellPx, y * cellPx, cellPx, cellPx);
      }
    }
    // symbols
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let y = 0; y < pattern.gridH; y++) {
      for (let x = 0; x < pattern.gridW; x++) {
        const code = pattern.grid[y * pattern.gridW + x];
        const c = codeMap.get(code);
        if (!c) continue;
        // Auto-shrink for 2-character labels so they fit
        const fontSize = c.symbol.length > 1 ? Math.floor(cellPx * 0.5) : Math.floor(cellPx * 0.7);
        ctx.font = `bold ${fontSize}px ui-monospace, "Courier New", monospace`;
        ctx.fillStyle = '#000';
        ctx.fillText(c.symbol, x * cellPx + cellPx/2, y * cellPx + cellPx/2 + 1);
      }
    }
  }, [pattern]);

  const downloadPNG = (canvasRef, name) => {
    if (!canvasRef.current) return;
    const link = document.createElement('a');
    link.download = name;
    link.href = canvasRef.current.toDataURL('image/png');
    link.click();
  };

  const printChart = () => {
    if (!pattern || !symbolCanvasRef.current) return;
    const dataUrl = symbolCanvasRef.current.toDataURL('image/png');
    const colorUrl = previewCanvasRef.current.toDataURL('image/png');
    const w = window.open('', '_blank');
    if (!w) { alert('Allow popups to print the chart'); return; }

    // physical size info
    const physW = canvasWidthIn;
    const physH = canvasHeightIn;
    const drillSizeMmStr = drillSizeMm.toFixed(2);

    // Tile chart across pages — each page covers a portion of the grid at a printable resolution
    // We aim for ~2 cells per cm = ~5mm per cell on the printed sheet
    const cellsPerPageW = 50;
    const cellsPerPageH = 60;
    const pagesX = Math.ceil(pattern.gridW / cellsPerPageW);
    const pagesY = Math.ceil(pattern.gridH / cellsPerPageH);

    const paletteRows = pattern.palette.map(p => `
      <tr>
        <td><span class="sym">${p.symbol}</span></td>
        <td><span class="sw" style="background:rgb(${p.r},${p.g},${p.b});${p.r+p.g+p.b > 600 ? 'border:1px solid #000' : ''}"></span></td>
        <td><b>DMC ${p.code}</b></td>
        <td>${p.name}</td>
        <td style="text-align:right">${p.count.toLocaleString()}</td>
        <td style="text-align:right">${(p.count / pattern.grid.length * 100).toFixed(1)}%</td>
      </tr>
    `).join('');

    // Build per-page tile images by cropping the master canvas
    const masterCanvas = symbolCanvasRef.current;
    const cellPx = masterCanvas.width / pattern.gridW;
    const tileImages = [];
    for (let py = 0; py < pagesY; py++) {
      for (let px = 0; px < pagesX; px++) {
        const tile = document.createElement('canvas');
        const startX = px * cellsPerPageW;
        const startY = py * cellsPerPageH;
        const tileW = Math.min(cellsPerPageW, pattern.gridW - startX);
        const tileH = Math.min(cellsPerPageH, pattern.gridH - startY);
        tile.width = tileW * cellPx;
        tile.height = tileH * cellPx;
        const tctx = tile.getContext('2d');
        tctx.drawImage(masterCanvas, startX * cellPx, startY * cellPx, tileW * cellPx, tileH * cellPx, 0, 0, tile.width, tile.height);
        tileImages.push({
          url: tile.toDataURL('image/png'),
          label: `Section row ${py+1} of ${pagesY}, col ${px+1} of ${pagesX}`,
          coords: `Cells (${startX+1}–${startX+tileW}, ${startY+1}–${startY+tileH})`
        });
      }
    }

    w.document.write(`
      <!doctype html>
      <html>
      <head>
        <title>Diamond Painting Pattern</title>
        <style>
          @page { size: letter; margin: 0.4in; }
          * { box-sizing: border-box; }
          body { font-family: Georgia, "Times New Roman", serif; margin: 0; color: #1a1a1a; }
          .page { page-break-after: always; padding: 0; }
          .page:last-child { page-break-after: auto; }
          h1 { font-size: 22pt; margin: 0 0 4pt; letter-spacing: -0.01em; }
          h2 { font-size: 13pt; margin: 14pt 0 6pt; border-bottom: 1.5px solid #1a1a1a; padding-bottom: 3pt; }
          .meta { font-size: 9pt; color: #555; margin-bottom: 10pt; }
          .meta b { color: #1a1a1a; }
          table { border-collapse: collapse; width: 100%; font-size: 9pt; }
          th { text-align: left; padding: 4pt 6pt; border-bottom: 1.5px solid #1a1a1a; font-weight: bold; }
          td { padding: 3pt 6pt; border-bottom: 0.5px solid #ccc; vertical-align: middle; }
          .sym { font-family: ui-monospace, "Courier New", monospace; font-size: 14pt; font-weight: bold; }
          .sw { display: inline-block; width: 20pt; height: 14pt; vertical-align: middle; }
          .preview { max-width: 100%; max-height: 6.5in; display: block; margin: 0 auto; border: 1px solid #888; }
          .tile { max-width: 100%; max-height: 9in; display: block; margin: 6pt auto 0; border: 1px solid #888; }
          .tile-label { font-size: 9pt; color: #555; text-align: center; margin-top: 4pt; }
          .summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12pt; margin-top: 8pt; }
          .stat { background: #f4f1ea; padding: 8pt 10pt; border-left: 3px solid #1a1a1a; }
          .stat-label { font-size: 8pt; text-transform: uppercase; letter-spacing: 0.05em; color: #666; }
          .stat-value { font-size: 14pt; font-weight: bold; margin-top: 2pt; }
          .footer { font-size: 7.5pt; color: #888; text-align: center; margin-top: 10pt; }
        </style>
      </head>
      <body>
        <div class="page">
          <h1>Diamond Painting Pattern</h1>
          <div class="meta">
            <b>Canvas:</b> ${physW}" × ${physH}" &nbsp;|&nbsp;
            <b>Drill size:</b> ${drillSizeMmStr}mm ${drillShape} &nbsp;|&nbsp;
            <b>Grid:</b> ${pattern.gridW} × ${pattern.gridH} &nbsp;|&nbsp;
            <b>Total drills:</b> ${pattern.grid.length.toLocaleString()} &nbsp;|&nbsp;
            <b>Colors:</b> ${pattern.palette.length}
          </div>
          <h2>Color Preview</h2>
          <img class="preview" src="${colorUrl}" />
          <h2>DMC Color Legend</h2>
          <table>
            <thead>
              <tr><th>Symbol</th><th>Color</th><th>DMC</th><th>Name</th><th style="text-align:right">Count</th><th style="text-align:right">%</th></tr>
            </thead>
            <tbody>${paletteRows}</tbody>
          </table>
          <div class="footer">Pattern generated for personal use • Tile pages follow</div>
        </div>
        ${tileImages.map((t, i) => `
          <div class="page">
            <h2 style="margin-top:0">${t.label}</h2>
            <div class="meta">${t.coords}</div>
            <img class="tile" src="${t.url}" />
          </div>
        `).join('')}
      </body>
      </html>
    `);
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 600);
  };

  return (
    <div className="min-h-screen" style={{ background: '#f4f1ea', fontFamily: 'Georgia, "Times New Roman", serif', color: '#1a1a1a' }}>
      <style>{`
        @keyframes shimmer {
          0%,100% { transform: rotate(0deg) scale(1); opacity: 0.8; }
          50% { transform: rotate(180deg) scale(1.1); opacity: 1; }
        }
        .sparkle { animation: shimmer 4s ease-in-out infinite; }
        .btn-primary { background: #1a1a1a; color: #f4f1ea; transition: all 0.2s; }
        .btn-primary:hover:not(:disabled) { background: #333; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
        .btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
        .btn-ghost { background: transparent; color: #1a1a1a; border: 1px solid #1a1a1a; transition: all 0.2s; }
        .btn-ghost:hover:not(:disabled) { background: #1a1a1a; color: #f4f1ea; }
        .panel { background: #fffdf8; border: 1px solid #d4cfc0; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
        input[type="number"], select { font-family: inherit; background: #fffdf8; border: 1px solid #c4bfb0; padding: 6px 8px; font-size: 14px; width: 100%; }
        input[type="number"]:focus, select:focus { outline: none; border-color: #1a1a1a; }
        input[type="range"] { width: 100%; accent-color: #1a1a1a; }
        .label-sm { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #666; font-family: ui-sans-serif, system-ui, sans-serif; font-weight: 600; }
        .num-display { font-variant-numeric: tabular-nums; font-family: ui-monospace, "Courier New", monospace; }
        .tab { padding: 8px 14px; border-bottom: 2px solid transparent; cursor: pointer; font-size: 13px; letter-spacing: 0.02em; transition: all 0.2s; }
        .tab.active { border-color: #1a1a1a; font-weight: bold; }
        .tab:hover { color: #000; }
      `}</style>

      {/* HEADER */}
      <header style={{ borderBottom: '1px solid #d4cfc0', background: '#fffdf8' }}>
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sparkles className="sparkle" style={{ color: '#b8860b' }} size={28} />
            <div>
              <div style={{ fontSize: '22px', fontWeight: 'bold', letterSpacing: '-0.02em' }}>Sparkle Atelier</div>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.15em', color: '#888' }}>Diamond Painting Pattern Studio</div>
            </div>
          </div>
          <div style={{ fontSize: '11px', color: '#888', textAlign: 'right' }}>
            DMC color matching · 240+ colors<br />
            Made for makers
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT — Controls */}
        <aside className="lg:col-span-3 space-y-5">
          <div className="panel p-5">
            <div className="flex items-center gap-2 mb-3">
              <ImageIcon size={16} />
              <span className="label-sm">Source Image</span>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFile} hidden />
            <button className="btn-primary w-full py-3 px-4 flex items-center justify-center gap-2 text-sm font-semibold" onClick={() => fileInputRef.current?.click()}>
              <Upload size={16} />
              {imageData ? 'Replace image' : 'Upload image'}
            </button>
            {imageData && (
              <div className="mt-3 text-xs num-display" style={{ color: '#666' }}>
                {imageData.width} × {imageData.height} px
              </div>
            )}
            {imageData && (
              <img src={imageData.dataUrl} alt="" style={{ marginTop: '12px', width: '100%', maxHeight: '180px', objectFit: 'contain', background: '#f4f1ea', border: '1px solid #d4cfc0' }} />
            )}
          </div>

          <div className="panel p-5">
            <div className="flex items-center gap-2 mb-4">
              <Settings size={16} />
              <span className="label-sm">Canvas Size</span>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="label-sm block mb-1">Width (in)</label>
                <input type="number" min="2" max="60" step="0.5" value={canvasWidthIn} onChange={e => setCanvasWidthIn(parseFloat(e.target.value) || 0)} />
              </div>
              <div>
                <label className="label-sm block mb-1">Height (in)</label>
                <input type="number" min="2" max="60" step="0.5" value={canvasHeightIn} onChange={e => setCanvasHeightIn(parseFloat(e.target.value) || 0)} />
              </div>
            </div>
            <div className="mb-3">
              <label className="label-sm block mb-1">Drill size (mm)</label>
              <select value={drillSizeMm} onChange={e => setDrillSizeMm(parseFloat(e.target.value))}>
                <option value="2.5">2.5 mm — standard (tightest)</option>
                <option value="2.8">2.8 mm — common</option>
                <option value="3.0">3.0 mm — large</option>
                <option value="2.0">2.0 mm — micro / mini</option>
              </select>
            </div>
            <div className="mb-3">
              <label className="label-sm block mb-1">Drill shape</label>
              <div className="flex gap-2">
                <button className={`flex-1 py-2 text-xs font-semibold ${drillShape === 'round' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setDrillShape('round')}>Round</button>
                <button className={`flex-1 py-2 text-xs font-semibold ${drillShape === 'square' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setDrillShape('square')}>Square</button>
              </div>
            </div>
            <div style={{ background: '#f4f1ea', padding: '10px 12px', borderLeft: '3px solid #b8860b', fontSize: '12px', marginTop: '12px' }}>
              <div style={{ fontWeight: 'bold' }}>Auto grid: <span className="num-display">{gridW} × {gridH}</span></div>
              <div style={{ color: '#666', marginTop: '2px' }}><span className="num-display">{totalDrills.toLocaleString()}</span> drills total</div>
            </div>
          </div>

          <div className="panel p-5">
            <div className="flex items-center gap-2 mb-3">
              <Palette size={16} />
              <span className="label-sm">Color Limit</span>
            </div>
            <div className="flex items-center gap-3 mb-2">
              <input type="range" min="5" max="80" value={maxColors} onChange={e => setMaxColors(parseInt(e.target.value))} />
              <span className="num-display font-bold" style={{ minWidth: '30px', textAlign: 'right' }}>{maxColors}</span>
            </div>
            <p style={{ fontSize: '11px', color: '#666', lineHeight: '1.4' }}>Fewer colors = simpler kit. More colors = better detail. 25–40 is typical.</p>
          </div>

          <button
            className="btn-primary w-full py-4 px-4 flex items-center justify-center gap-2 font-bold text-sm"
            onClick={generatePattern}
            disabled={!imageData || processing}
            style={{ letterSpacing: '0.05em' }}
          >
            {processing ? <><Loader2 className="animate-spin" size={16} /> PROCESSING…</> : <><Sparkles size={16} /> GENERATE PATTERN</>}
          </button>
        </aside>

        {/* CENTER — Preview */}
        <section className="lg:col-span-6">
          <div className="panel" style={{ minHeight: '500px' }}>
            {!pattern && !processing && (
              <div className="flex flex-col items-center justify-center h-full py-20" style={{ color: '#999' }}>
                <Grid3x3 size={56} strokeWidth={1} />
                <p className="mt-4 text-sm" style={{ fontStyle: 'italic' }}>
                  {imageData ? 'Press "Generate Pattern" to begin' : 'Upload an image to start'}
                </p>
              </div>
            )}

            {processing && (
              <div className="flex flex-col items-center justify-center h-full py-20">
                <Loader2 className="animate-spin" size={48} style={{ color: '#b8860b' }} />
                <p className="mt-4 text-sm" style={{ color: '#666' }}>Matching colors to DMC palette…</p>
              </div>
            )}

            {pattern && !processing && (
              <>
                <div style={{ borderBottom: '1px solid #d4cfc0', display: 'flex', padding: '0 16px' }}>
                  <div className={`tab ${view === 'color' ? 'active' : ''}`} onClick={() => setView('color')}>Color preview</div>
                  <div className={`tab ${view === 'symbol' ? 'active' : ''}`} onClick={() => setView('symbol')}>Symbol chart</div>
                  <div className={`tab ${view === 'side' ? 'active' : ''}`} onClick={() => setView('side')}>Side by side</div>
                </div>

                <div className="p-4">
                  <div className="flex items-center justify-between mb-3 text-xs" style={{ color: '#666' }}>
                    <div className="num-display">{pattern.gridW} × {pattern.gridH} grid · {pattern.grid.length.toLocaleString()} drills · {pattern.palette.length} colors</div>
                    <div className="flex items-center gap-2">
                      <span className="label-sm">Zoom</span>
                      <input type="range" min="0.3" max="3" step="0.1" value={zoom} onChange={e => setZoom(parseFloat(e.target.value))} style={{ width: '100px' }} />
                      <span className="num-display" style={{ minWidth: '36px' }}>{zoom.toFixed(1)}×</span>
                    </div>
                  </div>

                  <div style={{ overflow: 'auto', maxHeight: '70vh', background: '#f4f1ea', padding: '12px', border: '1px solid #d4cfc0' }}>
                    {view === 'color' && (
                      <canvas ref={previewCanvasRef} style={{ display: 'block', imageRendering: 'auto', width: `${pattern.gridW * 8 * zoom}px`, height: `${pattern.gridH * 8 * zoom}px` }} />
                    )}
                    {view === 'symbol' && (
                      <canvas ref={symbolCanvasRef} style={{ display: 'block', imageRendering: 'pixelated', width: `${pattern.gridW * 22 * zoom * 0.4}px`, height: `${pattern.gridH * 22 * zoom * 0.4}px` }} />
                    )}
                    {view === 'side' && (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <div className="label-sm mb-2">Color</div>
                          <canvas ref={previewCanvasRef} style={{ display: 'block', width: '100%' }} />
                        </div>
                        <div>
                          <div className="label-sm mb-2">Symbols</div>
                          <canvas ref={symbolCanvasRef} style={{ display: 'block', width: '100%' }} />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2 mt-4">
                    <button className="btn-ghost py-2 text-xs flex items-center justify-center gap-2" onClick={() => downloadPNG(previewCanvasRef, 'diamond-color-preview.png')}>
                      <Download size={14} /> Color PNG
                    </button>
                    <button className="btn-ghost py-2 text-xs flex items-center justify-center gap-2" onClick={() => downloadPNG(symbolCanvasRef, 'diamond-symbol-chart.png')}>
                      <Download size={14} /> Chart PNG
                    </button>
                    <button className="btn-primary py-2 text-xs flex items-center justify-center gap-2" onClick={printChart}>
                      <Printer size={14} /> Print full pattern
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </section>

        {/* RIGHT — Palette */}
        <aside className="lg:col-span-3">
          <div className="panel p-5" style={{ position: 'sticky', top: '20px' }}>
            <div className="flex items-center gap-2 mb-4">
              <Palette size={16} />
              <span className="label-sm">DMC Palette</span>
            </div>
            {!pattern ? (
              <p style={{ fontSize: '12px', color: '#999', fontStyle: 'italic' }}>Generate a pattern to see the color list.</p>
            ) : (
              <div style={{ maxHeight: '70vh', overflowY: 'auto', margin: '-4px', padding: '4px' }}>
                {pattern.palette.map((p, i) => (
                  <div key={p.code + i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 6px', borderBottom: '1px solid #ece8dc', fontSize: '12px' }}>
                    <span className="num-display" style={{ width: '20px', fontWeight: 'bold', textAlign: 'center', fontSize: '13px' }}>{p.symbol}</span>
                    <div style={{ width: '24px', height: '24px', background: `rgb(${p.r},${p.g},${p.b})`, border: '1px solid rgba(0,0,0,0.2)', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 'bold' }}>DMC {p.code}</div>
                      <div style={{ color: '#888', fontSize: '10px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                    </div>
                    <div className="num-display" style={{ fontSize: '10px', color: '#666', textAlign: 'right' }}>
                      <div>{p.count.toLocaleString()}</div>
                      <div>{(p.count / pattern.grid.length * 100).toFixed(1)}%</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </main>

      <footer style={{ borderTop: '1px solid #d4cfc0', marginTop: '40px', padding: '20px', textAlign: 'center', fontSize: '11px', color: '#888' }}>
        Built with care for makers · Patterns scale exactly to drill size · Print at 100% (no scaling) for perfect fit
      </footer>
    </div>
  );
}
